// server/api/projects/import-github.post.ts
import { db } from "~~/server/utils/db";
import { projects, conversations, messages } from "~~/server/database/schema";
import { eq, and } from "drizzle-orm";
import fs from 'node:fs/promises';
import path from 'node:path';

const GITHUB_API_BASE = "https://api.github.com";
const MAX_FILES = 500;
const MAX_FILE_SIZE_BYTES = 500 * 1024;

const generateSlug = (name: string) => {
    const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
};

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;
    if (!userId) throw createError({ statusCode: 401, message: "Unauthorized" });

    const { repoUrl, branch: userBranch, existingProjectSlug } = await readBody(event);
    if (!repoUrl) throw createError({ statusCode: 400, message: "GitHub URL required" });

    const match = repoUrl.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s#?]+)/);
    if (!match) throw createError({ statusCode: 400, message: "Invalid GitHub identifier" });
    const [_, owner, repo] = match;

    // Add token from runtime config
    const config = useRuntimeConfig();
    const githubToken = config.githubToken as string | undefined;

    const headers: HeadersInit = {
        'User-Agent': 'CodeContext-Importer',
        'Accept': 'application/vnd.github.v3+json',
        ...(githubToken ? { 'Authorization': `Bearer ${githubToken}` } : {})
    };

    // Resolve branch with fallback chain: user input → default_branch → master → main
    let branch = userBranch;
    if (!branch) {
        try {
            const repoRes = await fetch(
                `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
                { headers }
            );
            if (repoRes.ok) {
                const repoInfo = await repoRes.json();
                branch = repoInfo.default_branch;
                console.log(`[GitHub] Detected default branch: ${branch}`);
            } else {
                const errBody = await repoRes.json().catch(() => ({}));
                console.warn(`[GitHub] Repo info fetch failed: ${repoRes.status}`, errBody);
            }
        } catch (e) {
            console.warn("[GitHub] Failed to fetch repo info:", e);
        }
    }

    // Try branches in order until one works
    const branchCandidates = branch
        ? [branch]
        : ["main", "master", "dev", "develop"];

    let treeData: any = null;
    let resolvedBranch: string | null = null;

    for (const candidate of branchCandidates) {
        const treeRes = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${candidate}?recursive=1`,
            { headers }
        );

        if (treeRes.ok) {
            treeData = await treeRes.json();
            resolvedBranch = candidate;
            console.log(`[GitHub] Resolved branch: ${resolvedBranch}`);
            break;
        }

        const errBody = await treeRes.json().catch(() => ({}));
        console.warn(
            `[GitHub] Tree fetch failed for branch "${candidate}": ${treeRes.status}`,
            errBody
        );

        // Surface auth/rate-limit errors immediately — no point trying other branches
        if (treeRes.status === 401 || treeRes.status === 403) {
            throw createError({
                statusCode: 502,
                message: `GitHub API error (${treeRes.status}): ${(errBody as any)?.message ?? "Unauthorized or rate limited"}`
            });
        }
    }

    if (!treeData) {
        throw createError({
            statusCode: 404,
            message: `Could not find repository "${owner}/${repo}" or any of its branches. Make sure the repo is public or provide a GitHub token.`
        });
    }

    const allItems: any[] = treeData.tree || [];

    // Filter allowed files
    const allowedExtensions = [
        '.ts', '.js', '.vue', '.css', '.html', '.md',
        '.json', '.py', '.go', '.rs', '.sql', '.yaml', '.sh'
    ];

    const filteredFiles = allItems
        .filter((item: any) => {
            if (item.type !== "blob") return false;
            const ext = path.extname(item.path).toLowerCase();
            return (
                allowedExtensions.includes(ext) &&
                !item.path.includes('node_modules/') &&
                !item.path.includes('.git/') &&
                !item.path.includes('dist/')
            );
        })
        .slice(0, MAX_FILES);

    // Resolve project
    let projectId: number;
    let slug = existingProjectSlug;

    if (existingProjectSlug) {
        const [existingProject] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.slug, existingProjectSlug), eq(projects.userId, userId)))
            .limit(1);

        if (!existingProject) {
            throw createError({ statusCode: 404, message: "Project not found" });
        }
        projectId = existingProject.id;
    } else {
        slug = generateSlug(repo);
        const [newProject] = await db
            .insert(projects)
            .values({ name: `${owner}/${repo}`, userId, slug })
            .returning();
        projectId = newProject.id;
    }

    const projectDir = path.resolve(process.cwd(), '.storage', 'github', slug);

    // Download and save files
    let treeMarkdown = `### Repository Map: ${owner}/${repo} (branch: ${resolvedBranch})\n\n\`\`\`text\n`;
    let importedCount = 0;
    const failedFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of filteredFiles) {
        try {
            if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
                skippedFiles.push(file.path);
                treeMarkdown += `/${file.path} [skipped: too large (${Math.round(file.size / 1024)}KB)]\n`;
                continue;
            }

            const fileRes = await fetch(
                `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}?ref=${resolvedBranch}`,
                { headers }
            );
            if (!fileRes.ok) {
                failedFiles.push(file.path);
                continue;
            }

            const fileData = await fileRes.json();

            if (fileData.size && fileData.size > MAX_FILE_SIZE_BYTES) {
                skippedFiles.push(file.path);
                treeMarkdown += `/${file.path} [skipped: too large]\n`;
                continue;
            }

            if (fileData.encoding === 'base64') {
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const relativePath = file.path.replace(/^\/+/, '');
                const savePath = path.resolve(projectDir, relativePath);

                if (
                    !savePath.startsWith(projectDir + path.sep) &&
                    savePath !== projectDir
                ) {
                    failedFiles.push(file.path);
                    console.warn(`[WARN] Skipped suspicious path: ${file.path}`);
                    continue;
                }

                await fs.mkdir(path.dirname(savePath), { recursive: true });
                await fs.writeFile(savePath, content);

                treeMarkdown += `/${file.path}\n`;
                importedCount++;
            }
        } catch (e) {
            console.error(`Failed to import: ${file.path}`, e);
            failedFiles.push(file.path);
        }
    }

    treeMarkdown += `\`\`\`\n\n*Note to AI: Use the \`read_file\` tool with the exact paths listed above to inspect any file's contents.*`;

    const [conversation] = await db
        .insert(conversations)
        .values({ projectId, title: `Repo Map: ${repo}` })
        .returning();

    await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "system",
        content: `I have mapped **${importedCount}** files from \`${owner}/${repo}\` (branch: \`${resolvedBranch}\`) to this workspace.\n\n${treeMarkdown}`
    });

    return {
        success: true,
        projectSlug: slug,
        branch: resolvedBranch,
        importedCount,
        skippedCount: skippedFiles.length,
        failedCount: failedFiles.length,
        ...(failedFiles.length > 0 && { failedFiles }),
        ...(skippedFiles.length > 0 && { skippedFiles })
    };
});
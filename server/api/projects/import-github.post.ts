// server/api/projects/import-github.post.ts
import { db } from "~~/server/utils/db";
import { projects, conversations, messages } from "~~/server/database/schema";
import { eq, and } from "drizzle-orm";
import fs from 'node:fs/promises';
import path from 'node:path';

const GITHUB_API_BASE = "https://api.github.com";
const MAX_FILES = 500;
const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB per file

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

    const headers: HeadersInit = {
        'User-Agent': 'CodeContext-Importer',
        'Accept': 'application/vnd.github.v3+json'
    };

    let branch = userBranch || "main";
    if (!userBranch) {
        try {
            const repoInfo = await (
                await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers })
            ).json();
            branch = repoInfo.default_branch || "main";
        } catch {
            // Fall back to "main"
        }
    }

    // 1. Fetch File Tree
    const treeRes = await fetch(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
    );
    if (!treeRes.ok) {
        throw createError({ statusCode: 404, message: "Repository or branch not found." });
    }

    const treeData = await treeRes.json();
    const allItems: any[] = treeData.tree || [];

    // 2. Filter allowed files
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

    // 3. Resolve Project (existing or new)
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

    // 4. Download and save files locally
    let treeMarkdown = `### Repository Map: ${owner}/${repo}\n\n\`\`\`text\n`;
    let importedCount = 0;
    const failedFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of filteredFiles) {
        try {
            // Fix #5: Check file size before downloading content
            if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
                skippedFiles.push(file.path);
                treeMarkdown += `/${file.path} [skipped: too large (${Math.round(file.size / 1024)}KB)]\n`;
                continue;
            }

            const fileRes = await fetch(
                `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
                { headers }
            );
            if (!fileRes.ok) {
                failedFiles.push(file.path);
                continue;
            }

            const fileData = await fileRes.json();

            // Double-check size from API response
            if (fileData.size && fileData.size > MAX_FILE_SIZE_BYTES) {
                skippedFiles.push(file.path);
                treeMarkdown += `/${file.path} [skipped: too large]\n`;
                continue;
            }

            if (fileData.encoding === 'base64') {
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

                const relativePath = file.path.replace(/^\/+/, '');
                const savePath = path.resolve(projectDir, relativePath);

                // Path traversal guard
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

    // 5. Create initial conversation with repo map
    const [conversation] = await db
        .insert(conversations)
        .values({ projectId, title: `Repo Map: ${repo}` })
        .returning();

    await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "system",
        content: `I have mapped **${importedCount}** files from \`${owner}/${repo}\` to this workspace.\n\n${treeMarkdown}`
    });

    return {
        success: true,
        projectSlug: slug,
        importedCount,
        skippedCount: skippedFiles.length,
        failedCount: failedFiles.length,
        // Surface to client so users know what didn't import
        ...(failedFiles.length > 0 && { failedFiles }),
        ...(skippedFiles.length > 0 && { skippedFiles })
    };
});
// server/api/projects/import-github.post.ts
import { db } from "~~/server/utils/db";
import { projects, conversations, messages } from "~~/server/database/schema";
import { eq, and } from "drizzle-orm";
import fs from 'node:fs/promises';
import path from 'node:path';

const GITHUB_API_BASE = "https://api.github.com";

const generateSlug = (name: string) => {
    const baseSlug = name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
};

export default defineEventHandler(async (event) => {
    console.log("[GitHub Import] --- Starting New Import Request ---");

    const userId = event.context.user?.id;
    console.log(`[GitHub Import] User ID: ${userId}`);
    if (!userId) {
        console.error("[GitHub Import] Error: Unauthorized (No User ID)");
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const body = await readBody(event);
    console.log("[GitHub Import] Request Body:", body);

    const { repoUrl, branch: userBranch, existingProjectSlug } = body;
    if (!repoUrl) {
        console.error("[GitHub Import] Error: GitHub URL missing in body");
        throw createError({ statusCode: 400, message: "GitHub URL required" });
    }

    // Parse owner and repo
    const match = repoUrl.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s#?]+)/);
    if (!match) {
        console.error(`[GitHub Import] Error: Invalid GitHub identifier extracted from URL: ${repoUrl}`);
        throw createError({ statusCode: 400, message: "Invalid GitHub identifier" });
    }
    const [_, owner, repo] = match;
    console.log(`[GitHub Import] Parsed Owner: ${owner}, Repo: ${repo}`);

    const headers: Record<string, string> = {
        'User-Agent': 'CodeContext-Importer',
        'Accept': 'application/vnd.github.v3+json'
    };

    // Add GitHub Token if available (Highly recommended to avoid rate limits/404s)
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        console.log("[GitHub Import] GITHUB_TOKEN found and added to headers.");
    } else {
        console.warn("[GitHub Import] WARNING: No GITHUB_TOKEN found. Requests are unauthenticated and subject to strict rate limits.");
    }

    let branch = userBranch || "main";
    if (!userBranch) {
        console.log(`[GitHub Import] No user branch provided. Attempting to fetch default branch for ${owner}/${repo}...`);
        try {
            const repoRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
            const repoInfo = await repoRes.json();

            if (repoRes.ok && repoInfo.default_branch) {
                branch = repoInfo.default_branch;
                console.log(`[GitHub Import] Successfully fetched default branch: ${branch}`);
            } else {
                console.warn(`[GitHub Import] Failed to fetch repo info (Status: ${repoRes.status}). Falling back to 'main'. API Response:`, repoInfo);
                branch = "main";
            }
        } catch (e) {
            console.error("[GitHub Import] Exception while fetching default branch. Falling back to 'main'. Error:", e);
        }
    } else {
        console.log(`[GitHub Import] Using provided branch: ${branch}`);
    }

    // 1. Fetch File Tree
    const treeUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    console.log(`[GitHub Import] 1. Fetching File Tree from: ${treeUrl}`);
    const treeRes = await fetch(treeUrl, { headers });

    if (!treeRes.ok) {
        console.error(`[GitHub Import] Error: Failed to fetch tree. Status: ${treeRes.status} ${treeRes.statusText}`);
        throw createError({ statusCode: 404, message: `Repository or branch not found.` });
    }

    const treeData = await treeRes.json();
    const allItems = treeData.tree || [];
    console.log(`[GitHub Import] Successfully fetched tree. Total items found: ${allItems.length}`);

    // 2. Filter allowed files
    const allowedExtensions = ['.ts', '.js', '.vue', '.css', '.html', '.md', '.json', '.py', '.go', '.rs', '.sql', '.yaml', '.sh'];
    const filteredFiles = allItems.filter((item: any) => {
        if (item.type !== "blob") return false;
        const ext = path.extname(item.path).toLowerCase();
        return allowedExtensions.includes(ext) && !item.path.includes('node_modules/') && !item.path.includes('.git/') && !item.path.includes('dist/');
    }).slice(0, 500);

    console.log(`[GitHub Import] 2. Filtered files down to: ${filteredFiles.length} files (Max 500)`);

    // 3. Resolve Project (Existing or New)
    let projectId: number;
    let slug = existingProjectSlug;

    console.log(`[GitHub Import] 3. Resolving Project. Existing Slug: ${existingProjectSlug || 'None'}`);

    if (existingProjectSlug) {
        const [existingProject] = await db.select()
            .from(projects)
            .where(and(eq(projects.slug, existingProjectSlug), eq(projects.userId, userId)))
            .limit(1);

        if (!existingProject) {
            console.error(`[GitHub Import] Error: Existing project not found in DB for slug: ${existingProjectSlug}`);
            throw createError({ statusCode: 404, message: "Project not found" });
        }
        projectId = existingProject.id;
        console.log(`[GitHub Import] Linked to existing project ID: ${projectId}`);
    } else {
        slug = generateSlug(repo);
        console.log(`[GitHub Import] Generating new project with slug: ${slug}`);
        const [newProject] = await db.insert(projects).values({ name: `${owner}/${repo}`, userId, slug }).returning();
        projectId = newProject.id;
        console.log(`[GitHub Import] Created new project ID: ${projectId}`);
    }

    // 4. Download and Save Files Locally
    const projectDir = path.join(process.cwd(), '.storage', 'github', slug);
    console.log(`[GitHub Import] 4. Setup local storage directory: ${projectDir}`);

    let treeMarkdown = `### Repository Map: ${owner}/${repo}\n\n\`\`\`text\n`;
    let importedCount = 0;

    for (const file of filteredFiles) {
        try {
            console.log(`[GitHub Import]   -> Fetching file: ${file.path}`);
            const fileRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`, { headers });

            if (!fileRes.ok) {
                console.warn(`[GitHub Import]   -> Failed to fetch file: ${file.path} (Status: ${fileRes.status})`);
                continue;
            }

            const fileData = await fileRes.json();
            if (fileData.encoding === 'base64') {
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const savePath = path.join(projectDir, file.path);

                await fs.mkdir(path.dirname(savePath), { recursive: true });
                await fs.writeFile(savePath, content);

                treeMarkdown += `/${file.path}\n`;
                importedCount++;
            } else {
                console.warn(`[GitHub Import]   -> Unsupported encoding for ${file.path}: ${fileData.encoding}`);
            }
        } catch (e) {
            console.error(`[GitHub Import]   -> Exception while processing file ${file.path}:`, e);
        }
    }

    console.log(`[GitHub Import] Successfully downloaded ${importedCount} files.`);

    treeMarkdown += `\`\`\`\n\n*Note to AI: Use the \`read_file\` tool with the exact paths listed above to inspect the contents of any file.*`;

    // 5. Create Initial Conversation Context
    console.log(`[GitHub Import] 5. Creating Initial Conversation Context...`);
    const [conversation] = await db.insert(conversations).values({ projectId: projectId, title: `Repo Map: ${repo}` }).returning();
    await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "system",
        content: `I have mapped **${importedCount}** files from \`${owner}/${repo}\` to this workspace. \n\n${treeMarkdown}`
    });

    console.log(`[GitHub Import] --- Import Successful ---`);
    return { success: true, projectSlug: slug };
});
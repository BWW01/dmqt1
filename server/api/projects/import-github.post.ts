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
    const userId = event.context.user?.id;
    if (!userId) throw createError({ statusCode: 401, message: "Unauthorized" });

    const { repoUrl, branch: userBranch, existingProjectSlug } = await readBody(event);
    if (!repoUrl) throw createError({ statusCode: 400, message: "GitHub URL required" });

    // Parse owner and repo
    const match = repoUrl.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s#?]+)/);
    if (!match) throw createError({ statusCode: 400, message: "Invalid GitHub identifier" });
    const [_, owner, repo] = match;

    const headers = {
        'User-Agent': 'CodeContext-Importer',
        'Accept': 'application/vnd.github.v3+json'
    };

    let branch = userBranch || "main";
    if (!userBranch) {
        try {
            const repoInfo = await (await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers })).json();
            branch = repoInfo.default_branch || "main";
        } catch (e) {}
    }

    // 1. Fetch File Tree
    const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeRes.ok) throw createError({ statusCode: 404, message: `Repository or branch not found.` });

    const treeData = await treeRes.json();
    const allItems = treeData.tree || [];

    // 2. Filter allowed files
    const allowedExtensions = ['.ts', '.js', '.vue', '.css', '.html', '.md', '.json', '.py', '.go', '.rs', '.sql', '.yaml', '.sh'];
    const filteredFiles = allItems.filter((item: any) => {
        if (item.type !== "blob") return false;
        const ext = path.extname(item.path).toLowerCase();
        return allowedExtensions.includes(ext) && !item.path.includes('node_modules/') && !item.path.includes('.git/') && !item.path.includes('dist/');
    }).slice(0, 500);

    // 3. Resolve Project (Existing or New)
    let projectId: number;
    let slug = existingProjectSlug;

    if (existingProjectSlug) {
        const [existingProject] = await db.select()
            .from(projects)
            .where(and(eq(projects.slug, existingProjectSlug), eq(projects.userId, userId)))
            .limit(1);

        if (!existingProject) throw createError({ statusCode: 404, message: "Project not found" });
        projectId = existingProject.id;
    } else {
        slug = generateSlug(repo);
        const [newProject] = await db.insert(projects).values({ name: `${owner}/${repo}`, userId, slug }).returning();
        projectId = newProject.id;
    }

    // 4. Download and Save Files Locally (BIZTONSÁGOS MAPPA)
    const projectDir = path.join(process.cwd(), '.storage', 'github', slug);
    let treeMarkdown = `### Repository Map: ${owner}/${repo}\n\n\`\`\`text\n`;
    let importedCount = 0;

    for (const file of filteredFiles) {
        try {
            const fileRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`, { headers });
            if (!fileRes.ok) continue;

            const fileData = await fileRes.json();
            if (fileData.encoding === 'base64') {
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const savePath = path.join(projectDir, file.path);

                await fs.mkdir(path.dirname(savePath), { recursive: true });
                await fs.writeFile(savePath, content);

                treeMarkdown += `/${file.path}\n`;
                importedCount++;
            }
        } catch (e) { console.error(`Failed: ${file.path}`); }
    }
    treeMarkdown += `\`\`\`\n\n*Note to AI: Use the \`read_file\` tool with the exact paths listed above to inspect the contents of any file.*`;

    // 5. Create Initial Conversation Context
    const [conversation] = await db.insert(conversations).values({ projectId: projectId, title: `Repo Map: ${repo}` }).returning();
    await db.insert(messages).values({
        conversationId: conversation.id,
        sender: "system",
        content: `I have mapped **${importedCount}** files from \`${owner}/${repo}\` to this workspace. \n\n${treeMarkdown}`
    });

    return { success: true, projectSlug: slug };
});
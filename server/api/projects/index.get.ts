// server/api/projects/index.get.ts
import { db } from "~~/server/utils/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { projects, conversations, runs } from "~~/server/database/schema";

export default defineEventHandler(async (event) => {
    const userId = event.context.userId as number;

    // 1. Get all projects for the user
    const userProjects = await db
        .select({
            id: projects.id,
            slug: projects.slug,
            name: projects.name,
            createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.createdAt));

    if (userProjects.length === 0) return [];

    // Extract IDs to use in our count queries
    const projectIds = userProjects.map(p => p.id);

    // 2. Get conversation counts grouped by project
    const conversationCounts = await db
        .select({
            projectId: conversations.projectId,
            total: count(),
        })
        .from(conversations)
        // Check if projectId is in our array
        .where(sql`${conversations.projectId} IN ${projectIds}`)
        .groupBy(conversations.projectId);

    // 3. Get run counts grouped by project
    const runCounts = await db
        .select({
            projectId: runs.projectId,
            total: count(),
        })
        .from(runs)
        .where(sql`${runs.projectId} IN ${projectIds}`)
        .groupBy(runs.projectId);

    // 4. Merge the counts back into the projects array
    return userProjects.map(project => {
        const convCount = conversationCounts.find(c => c.projectId === project.id)?.total || 0;
        const runCount = runCounts.find(r => r.projectId === project.id)?.total || 0;

        return {
            ...project,
            _count: {
                conversations: convCount,
                runs: runCount,
            }
        };
    });
});
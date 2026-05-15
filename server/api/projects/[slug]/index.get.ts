// server/api/projects/[slug]/index.get.ts
import { db } from "~~/server/utils/db";
import { eq, and, desc, count } from "drizzle-orm";
// Assuming you have a 'runs' table in your schema based on the original Prisma query
import { projects, conversations, messages, runs } from "~~/server/database/schema";

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }
    const slug = getRouterParam(event, "slug");

    // 1. Get the base project
    const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.slug, slug), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw createError({ statusCode: 404, message: "Project not found" });
    }

    // 2. Get project runs count
    const [runData] = await db
        .select({ total: count() })
        .from(runs)
        .where(eq(runs.projectId, project.id));

    // 3. Get conversations with message counts
    const projectConversations = await db
        .select({
            id: conversations.id,
            title: conversations.title,
            createdAt: conversations.createdAt,
            updatedAt: conversations.updatedAt,
            messagesCount: count(messages.id),
        })
        .from(conversations)
        .leftJoin(messages, eq(messages.conversationId, conversations.id))
        .where(eq(conversations.projectId, project.id))
        .groupBy(conversations.id)
        .orderBy(desc(conversations.updatedAt));

    // 4. Assemble the final object
    return {
        ...project,
        conversations: projectConversations.map((conv) => ({
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            _count: { messages: conv.messagesCount },
        })),
        _count: { runs: runData.total },
    };
});
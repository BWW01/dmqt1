// server/api/projects/[slug]/conversations/index.get.ts
import { db } from "~~/server/utils/db";
import { eq, and, desc, count } from "drizzle-orm";
import { projects, conversations, messages } from "~~/server/database/schema";

export default defineEventHandler(async (event) => {
    const userId = event.context.userId as number;
    const slug = getRouterParam(event, "slug");

    // 1. Get Project ID
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.slug, slug), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw createError({ statusCode: 404, message: "Project not found" });
    }

    // 2. Get conversations with message counts
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

    // 3. Map to match the frontend's expected Prisma structure
    return projectConversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        _count: { messages: conv.messagesCount },
    }));
});
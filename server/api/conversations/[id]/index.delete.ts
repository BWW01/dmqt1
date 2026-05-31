// server/api/conversations/[id]/index.delete.ts
import { db } from "~~/server/utils/db";
import { eq, and } from "drizzle-orm";
import { conversations, projects } from "~~/server/database/schema";

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;
    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const id = Number(getRouterParam(event, 'id'));
    if (!id) {
        throw createError({ statusCode: 400, message: "Missing conversation ID" });
    }

    // Verify ownership before deleting
    const [conversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .innerJoin(projects, eq(conversations.projectId, projects.id))
        .where(and(eq(conversations.id, id), eq(projects.userId, userId)))
        .limit(1);

    if (!conversation) {
        throw createError({ statusCode: 404, message: "Conversation not found" });
    }

    try {
        await db.delete(conversations).where(eq(conversations.id, id));
        return { success: true, message: "Sequence terminated." };
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: `Failed to terminate sequence: ${error.message}`
        });
    }
});
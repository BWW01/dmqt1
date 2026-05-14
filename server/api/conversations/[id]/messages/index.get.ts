// server/api/conversations/[id]/messages/index.get.ts
import { db } from "~~/server/utils/db";
import { eq, and, asc } from "drizzle-orm";
import { conversations, messages, projects } from "~~/server/database/schema";

import { verifyPassword, signToken } from "~~/server/utils/auth";
import { chatCompletion, listModels } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const userId = event.context.userId as number;
    const conversationId = Number(getRouterParam(event, "id"));

    // Jogosultság ellenőrzés (Inner join to check project ownership)
    const [conversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .innerJoin(projects, eq(conversations.projectId, projects.id))
        .where(
            and(
                eq(conversations.id, conversationId),
                eq(projects.userId, userId)
            )
        )
        .limit(1);

    if (!conversation) {
        throw createError({
            statusCode: 404,
            message: "Conversation not found",
        });
    }

    const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt)); // Requires 'asc' imported from drizzle-orm

    return conversationMessages;
});
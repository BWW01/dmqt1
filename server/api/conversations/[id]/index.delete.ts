// server/api/conversations/[id]/index.delete.ts
import { db } from "~~/server/utils/db";
import { eq } from "drizzle-orm";
import { conversations, messages } from "~~/server/database/schema";

export default defineEventHandler(async (event) => {
    // Kinyerjük az ID-t az URL-ből
    const id = Number(getRouterParam(event, 'id'));

    if (!id) {
        throw createError({ statusCode: 400, message: "Missing conversation ID" });
    }

    try {
        // 1. Először töröljük a beszélgetéshez tartozó összes üzenetet
        // (Erre azért van szükség, mert a Prisma/SQL adatbázisban idegen kulcs kényszer van)
        await db.delete(messages)
            .where(eq(messages.conversationId, id));

        // 2. Utána töröljük magát a beszélgetést (sequence)
        await db.delete(conversations)
            .where(eq(conversations.id, id));

        return { success: true, message: "Sequence terminated." };
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            message: `Failed to terminate sequence: ${error.message}`
        });
    }
});
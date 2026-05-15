// server/api/conversations/[id]/messages/index.post.ts
import { db } from "~~/server/utils/db";
import { eq, asc } from "drizzle-orm";
import { messages, users } from "~~/server/database/schema";
import { chatCompletion } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;
    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const conversationId = Number(getRouterParam(event, 'id'));
    const body = await readBody(event);
    const { content, model } = body;

    if (!content) {
        throw createError({ statusCode: 400, message: "Content is required" });
    }

    // --- 1. KREDIT SZIGORÚ ELLENŐRZÉSE ---
    const [user] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));

    // Biztosítjuk, hogy valódi lebegőpontos számként kezeljük
    const currentCredits = Number(user?.credits || 0);

    if (!user || currentCredits <= 0) {
        throw createError({
            statusCode: 402,
            message: `ACCESS_DENIED: Insufficient tokens. Current balance: ${currentCredits}`
        });
    }
    // -------------------------------------

    // 2. Mentsük el a User üzenetét
    await db.insert(messages).values({
        conversationId,
        sender: "user",
        content: content
    });

    const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));

    const aiMessages = history.map(msg => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content
    }));

    const activeModel = model || "meta-llama/Llama-3-70b-chat";

    try {
        const aiResponse = await chatCompletion(activeModel, aiMessages);
        const aiResponseText = aiResponse.choices[0].message.content;

        // --- 3. KÖLTSÉG BIZTOS KISZÁMÍTÁSA ÉS LEVONÁSA ---
        const usage = aiResponse.usage || {};

        // Ha van becsült ár a DeepInfrától, azt használjuk
        let cost = usage.estimated_cost;

        // Ha nincs becsült ár (undefined), számolunk egyet a felhasznált tokenek alapján
        if (cost === undefined || cost === null) {
            const totalTokens = usage.total_tokens || 10;
            cost = totalTokens * 0.000001; // Egy átlagos, nagyon pici szorzó
        }

        if (cost > 0) {
            const newBalance = currentCredits - cost;
            await db.update(users)
                .set({ credits: newBalance })
                .where(eq(users.id, userId));
        }
        // ------------------------------------------------

        // 4. Mentsük el a System válaszát
        const [assistantMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                sender: "assistant",
                content: aiResponseText
            })
            .returning();

        return assistantMessage;

    } catch (error: any) {
        console.error("AI Communication Error:", error);
        const [errorMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                sender: "assistant",
                content: `**[SYSTEM_ERROR]:** Connection to neural net failed. \n\n\`${error.message}\``
            })
            .returning();

        return errorMessage;
    }
});
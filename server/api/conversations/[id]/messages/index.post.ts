// server/api/conversations/[id]/messages/index.post.ts
import { db } from "~~/server/utils/db";
import { eq, asc } from "drizzle-orm";
import { messages } from "~~/server/database/schema";

import { chatCompletion } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const conversationId = Number(getRouterParam(event, 'id'));
    const body = await readBody(event);

    // A frontend most már küldi a contentet ÉS a kiválasztott modellt is!
    const { content, model } = body;

    if (!content) {
        throw createError({ statusCode: 400, message: "Content is required" });
    }

    // 1. Mentsük el a User (Operator) üzenetét az adatbázisba
    await db.insert(messages).values({
        conversationId,
        sender: "user",
        content: content
    });

    // 2. Kérjük le a beszélgetés eddigi történetét (kontextus az AI-nak)
    const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt));

    // Átalakítjuk a DeepInfra (OpenAI) formátumára
    const aiMessages = history.map(msg => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content
    }));

    // 3. AI Hívás: Ha a felhasználó nem választott modellt, használjunk egy alapértelmezettet
    const activeModel = model || "meta-llama/Llama-3-70b-chat";

    try {
        const aiResponse = await chatCompletion(activeModel, aiMessages);

        // Kinyerjük a szöveget a válaszból
        const aiResponseText = aiResponse.choices[0].message.content;

        // 4. Mentsük el a System (AI) válaszát az adatbázisba
        const [assistantMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                sender: "assistant",
                content: aiResponseText
            })
            .returning(); // Get the inserted row back

        // Visszaadjuk az új üzenetet a frontendnek
        return assistantMessage;

    } catch (error: any) {
        console.error("AI Communication Error:", error);

        // Ha az AI elszáll, mentsünk el egy hibaüzenetet, hogy a UI-on is látszódjon a probléma
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
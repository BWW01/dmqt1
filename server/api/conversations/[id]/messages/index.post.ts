// server/api/conversations/[id]/messages/index.post.ts
import { db } from "~~/server/utils/db";
import { eq, asc, and, sql } from "drizzle-orm";
import { messages, users, conversations } from "~~/server/database/schema";
import { chatCompletionStream } from "~~/server/utils/deepinfra";

const COST_FALLBACK_PER_TOKEN = 0.000001;
const CREDIT_UNIT = 1_000_000; // 1 credit = $0.000001

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

    const [user] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));

    const currentCredits = Number(user?.credits || 0);
    if (!user || currentCredits <= 0) {
        throw createError({
            statusCode: 402,
            message: `ACCESS_DENIED: Insufficient tokens. Current balance: ${currentCredits}`
        });
    }

    // Save user message and bump conversation timestamp
    await db.insert(messages).values({ conversationId, sender: "user", content });
    await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

    // Load full history including the message just saved
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

    setHeader(event, 'Content-Type', 'text/event-stream');
    setHeader(event, 'Cache-Control', 'no-cache');
    setHeader(event, 'Connection', 'keep-alive');

    let fullText = "";
    let usageData: any = null;

    try {
        const stream = await chatCompletionStream(activeModel, aiMessages);
        if (!stream) throw new Error("No stream returned");

        const reader = stream.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            for (const line of chunkText.split("\n").filter(l => l.trim())) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.usage) usageData = data.usage;
                        const delta = data.choices?.[0]?.delta;
                        if (delta?.content) {
                            fullText += delta.content;
                            event.node.res.write(
                                `data: ${JSON.stringify({ type: "chunk", text: delta.content })}\n\n`
                            );
                        }
                    } catch { /* skip malformed lines */ }
                }
            }
        }

        // Atomic credit deduction
        const dollarCost = typeof usageData?.estimated_cost === "number" && usageData.estimated_cost > 0
            ? usageData.estimated_cost
            : (usageData?.total_tokens || 10) * COST_FALLBACK_PER_TOKEN;
        const cost = Math.ceil(dollarCost * CREDIT_UNIT);

        if (cost > 0) {
            await db.update(users)
                .set({ credits: sql`${users.credits} - ${cost}` })
                .where(and(eq(users.id, userId), sql`${users.credits} >= ${cost}`));
        }

        const [assistantMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                sender: "assistant",
                content: fullText,
                metaJson: { model: activeModel, usage: usageData, timestamp: new Date().toISOString() }
            })
            .returning();

        await db.update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));

        event.node.res.write(
            `data: ${JSON.stringify({ type: "done", messageId: assistantMessage.id })}\n\n`
        );

    } catch (error: any) {
        const [errorMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                sender: "assistant",
                content: `**[SYSTEM_ERROR]:** ${error.message}`
            })
            .returning();

        event.node.res.write(
            `data: ${JSON.stringify({ type: "error", error: error.message, messageId: errorMessage.id })}\n\n`
        );
    }

    event.node.res.end();
});

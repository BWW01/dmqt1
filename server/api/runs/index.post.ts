// server/api/runs/index.post.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from "~~/server/utils/db";
import { eq, and, asc } from "drizzle-orm";
import { runs, runModels, runOutputs, projects, messages } from "~~/server/database/schema";
import { chatCompletion } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const userId = event.context.userId as number;
    const body = await readBody(event);
    const {
        models,
        userInput,
        params,
        projectSlug,
        conversationId,
        systemPrompt,
    } = body;

    // Alapvető validáció
    if (!models?.length || !userInput || !projectSlug) {
        throw createError({
            statusCode: 400,
            message: "models, userInput, and projectSlug are required",
        });
    }

    // Projekt jogosultság ellenőrzés
    const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.slug, projectSlug), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw createError({ statusCode: 404, message: "Project not found" });
    }

    // --- FÁJL TARTALOM BEOLVASÁSA ÉS BEILLESZTÉSE ---
    let processedInput = userInput;
    const attachmentRegex = /\[ATTACHMENT_STREAM: .*? \| PATH: (.*?)\]/g;
    const matches = [...userInput.matchAll(attachmentRegex)];

    for (const match of matches) {
        const relativePath = match[1];
        const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        const fullPath = path.join(process.cwd(), 'public', cleanPath);

        try {
            const fileContent = await fs.readFile(fullPath, 'utf-8');
            const replacementText = `\n\n--- ATTACHED_FILE_CONTENT_START (${relativePath}) ---\n${fileContent}\n--- ATTACHED_FILE_CONTENT_END ---\n`;
            processedInput = processedInput.replace(match[0], replacementText);
        } catch (err: any) {
            console.error(`File read error at ${fullPath}:`, err.message);
            processedInput = processedInput.replace(match[0], `\n[ERROR: Could not read file content at ${relativePath}]\n`);
        }
    }

    // Run rekord létrehozása az adatbázisban
    const [run] = await db
        .insert(runs)
        .values({
            projectId: project.id,
            conversationId: conversationId ?? null,
            createdBy: userId,
            userInput,
            paramsJson: params ?? {},
            status: "running",
        })
        .returning();

    // Drizzle Bulk Insert: Much faster than Promise.all(prisma.create)
    const runModelsData = (models as string[]).map((modelName) => ({
        runId: run.id,
        modelName,
        status: "queued"
    }));

    const insertedRunModels = await db
        .insert(runModels)
        .values(runModelsData)
        .returning();

    // Aszinkron végrehajtás indítása
    const executeRun = async () => {
        await Promise.allSettled(
            insertedRunModels.map(async (rm) => {
                await db
                    .update(runModels)
                    .set({ status: "running", startedAt: new Date() })
                    .where(eq(runModels.id, rm.id));

                const t0 = Date.now();
                try {
                    const aiMessages: { role: string; content: string }[] = [];
                    if (systemPrompt) {
                        aiMessages.push({ role: "system", content: systemPrompt });
                    }

                    // Korábbi üzenetek betöltése a kontextushoz
                    if (conversationId) {
                        const history = await db
                            .select()
                            .from(messages)
                            .where(eq(messages.conversationId, conversationId))
                            .orderBy(asc(messages.createdAt));

                        for (const msg of history) {
                            aiMessages.push({
                                role: msg.sender === "user" ? "user" : "assistant",
                                content: msg.content,
                            });
                        }
                    }

                    aiMessages.push({ role: "user", content: processedInput });

                    const res = await chatCompletion(
                        rm.modelName,
                        aiMessages,
                        params ?? {},
                    );

                    const latency = Date.now() - t0;
                    const text = res.choices?.[0]?.message?.content ?? "[no content]";

                    // Kimenet mentése
                    await db.insert(runOutputs).values({
                        runModelId: rm.id,
                        outputText: text,
                        rawResponseJson: res,
                    });

                    await db
                        .update(runModels)
                        .set({
                            status: "succeeded",
                            latencyMs: latency,
                            finishedAt: new Date(),
                        })
                        .where(eq(runModels.id, rm.id));

                } catch (err: any) {
                    const latency = Date.now() - t0;
                    await db
                        .update(runModels)
                        .set({
                            status: "failed",
                            errorCode: err.name === "AbortError" ? "TIMEOUT" : "API_ERROR",
                            errorMessage: err.message,
                            latencyMs: latency,
                            finishedAt: new Date(),
                        })
                        .where(eq(runModels.id, rm.id));
                }
            }),
        );

        // Végső Run státusz kiszámítása
        const statuses = await db
            .select({ status: runModels.status })
            .from(runModels)
            .where(eq(runModels.runId, run.id));

        const allOk = statuses.every((s) => s.status === "succeeded");
        const anyOk = statuses.some((s) => s.status === "succeeded");

        await db
            .update(runs)
            .set({
                status: allOk ? "succeeded" : anyOk ? "partial" : "failed",
                finishedAt: new Date(),
            })
            .where(eq(runs.id, run.id));

        // Ha a kérés egy beszélgetéshez tartozik, rögzítjük az üzenetet
        if (conversationId) {
            await db.insert(messages).values({
                conversationId,
                sender: "user",
                content: userInput,
            });
        }
    };

    // A háttérfolyamat indítása
    executeRun().catch(console.error);

    return { runId: run.id, status: "running" };
});
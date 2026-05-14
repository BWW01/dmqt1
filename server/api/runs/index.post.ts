// server/api/runs/index.post.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from "~~/server/utils/db";
import { eq, and, asc } from "drizzle-orm";
import { runs, runModels, runOutputs, projects, messages } from "~~/server/database/schema";
import { chatCompletionStream } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const userId = event.context.userId as number;
    const body = await readBody(event);
    const { models, userInput, params, projectSlug, conversationId, systemPrompt, includeLocation } = body;

    if (!models?.length || !userInput || !projectSlug) {
        throw createError({ statusCode: 400, message: "models, userInput, and projectSlug are required" });
    }

    const [project] = await db.select()
        .from(projects)
        .where(and(eq(projects.slug, projectSlug), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw createError({ statusCode: 404, message: "Project not found" });
    }

    // --- LOKÁCIÓ LEKÉRDEZÉSE HA KÉRVE LETT ---
    let locationData: any = null;
    if (includeLocation) {
        try {
            let ip = getRequestIP(event, { xForwardedFor: true });
            console.log("> Észlelt IP:", ip);

            // Ha lokális IP-t vagy Docker belső IP-t észlel, használjunk egy teszt publikus IP-t
            if (!ip || ip === '::1' || ip.includes('127.0.0.1') || ip.startsWith('172.')) {
                console.log("> Lokális környezet, teszt IP beállítása...");
                ip = '8.8.8.8';
            }

            if (ip) {
                const locRes = await fetch(`http://ip-api.com/json/${ip}`);
                if (locRes.ok) {
                    const data = await locRes.json();
                    if (data.status === "success") {
                        locationData = data;
                    } else {
                        console.warn("> IP API hiba:", data);
                    }
                }
            }
        } catch (e) {
            console.error("Location fetch error", e);
        }
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
            processedInput = processedInput.replace(match[0], `\n\n--- ATTACHED_FILE: ${relativePath} ---\n${fileContent}\n`);
        } catch (err: any) {
            processedInput = processedInput.replace(match[0], `\n[Fajl olvasasi hiba: ${relativePath}]\n`);
        }
    }

    // Run rekord létrehozása
    const [run] = await db.insert(runs).values({
        projectId: project.id,
        conversationId: conversationId ?? null,
        createdBy: userId,
        userInput,
        paramsJson: params ?? {},
        status: "running",
    }).returning();

    const runModelsData = (models as string[]).map((modelName) => ({
        runId: run.id,
        modelName,
        status: "running"
    }));

    const insertedRunModels = await db.insert(runModels).values(runModelsData).returning();

    // --- FELHASZNÁLÓI ÜZENET MENTÉSE METAADATOKKAL ---
    if (conversationId) {
        const metaJson = {
            timestamp: new Date().toISOString(),
            systemPrompt: systemPrompt || "Nincs megadva",
            ...(locationData && locationData.status === "success" ? { location: `${locationData.city}, ${locationData.country}` } : {})
        };

        await db.insert(messages).values({
            conversationId,
            sender: "user",
            content: userInput,
            metaJson: metaJson
        });
    }

    // --- STREAMING (SSE) FEJLÉCEK BEÁLLÍTÁSA ---
    setHeader(event, 'Content-Type', 'text/event-stream');
    setHeader(event, 'Cache-Control', 'no-cache');
    setHeader(event, 'Connection', 'keep-alive');

    // Kezdeti üzenet küldése a frontendnek
    event.node.res.write(`data: ${JSON.stringify({ type: "init", runId: run.id })}\n\n`);

    // Párhuzamos stream-ek indítása és feldolgozása
    await Promise.allSettled(
        insertedRunModels.map(async (rm) => {
            const t0 = Date.now();
            let fullText = "";
            let usageData: any = null; // Költség és token adatok tárolója

            try {
                const aiMessages: { role: string; content: string }[] = [];
                if (systemPrompt) aiMessages.push({ role: "system", content: systemPrompt });

                if (conversationId) {
                    const history = await db.select()
                        .from(messages)
                        .where(eq(messages.conversationId, conversationId))
                        .orderBy(asc(messages.createdAt));

                    for (const msg of history) {
                        aiMessages.push({ role: msg.sender === "user" ? "user" : "assistant", content: msg.content });
                    }
                }

                aiMessages.push({ role: "user", content: processedInput });

                // DeepInfra hívás streaming módban
                const stream = await chatCompletionStream(rm.modelName, aiMessages, params ?? {});

                if (stream) {
                    const reader = stream.getReader();
                    const decoder = new TextDecoder("utf-8");

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunkText = decoder.decode(value, { stream: true });
                        const lines = chunkText.split("\n").filter((line: string) => line.trim() !== "");

                        for (const line of lines) {
                            if (line.startsWith("data: ") && line !== "data: [DONE]") {
                                try {
                                    const data = JSON.parse(line.slice(6));

                                    // Usage adatok elkapása, ha megérkezik
                                    if (data.usage) {
                                        usageData = data.usage;
                                    }

                                    const delta = data.choices?.[0]?.delta?.content || "";
                                    if (delta) {
                                        fullText += delta;
                                        event.node.res.write(`data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: delta })}\n\n`);
                                    }
                                } catch (e) {
                                    // Hibás parse ignorálása csonka JSON esetén
                                }
                            }
                        }
                    }
                }

                const latency = Date.now() - t0;

                // Kimenet véglegesítése az adatbázisban a költségekkel együtt
                await db.insert(runOutputs).values({
                    runModelId: rm.id,
                    outputText: fullText,
                    rawResponseJson: usageData || {}
                });
                await db.update(runModels).set({
                    status: "succeeded",
                    latencyMs: latency,
                    finishedAt: new Date()
                }).where(eq(runModels.id, rm.id));

                // --- AI VÁLASZ MENTÉSE A CHAT TÖRTÉNETBE ---
                if (conversationId) {
                    await db.insert(messages).values({
                        conversationId,
                        sender: "assistant",
                        content: fullText,
                        metaJson: {
                            model: rm.modelName,
                            latencyMs: latency,
                            timestamp: new Date().toISOString(),
                            usage: usageData
                        }
                    });
                }

                // Befejezés jelzése a kliensnek, továbbítva a usage adatokat is
                event.node.res.write(`data: ${JSON.stringify({ type: "done", modelId: rm.id, usage: usageData })}\n\n`);

            } catch (err: any) {
                const latency = Date.now() - t0;
                await db.update(runModels).set({ status: "failed", errorMessage: err.message, latencyMs: latency, finishedAt: new Date() }).where(eq(runModels.id, rm.id));

                event.node.res.write(`data: ${JSON.stringify({ type: "error", modelId: rm.id, error: err.message })}\n\n`);
            }
        })
    );

    // Teljes run státusz frissítése
    const statuses = await db.select({ status: runModels.status }).from(runModels).where(eq(runModels.runId, run.id));
    const allOk = statuses.every((s) => s.status === "succeeded");
    const anyOk = statuses.some((s) => s.status === "succeeded");

    await db.update(runs).set({ status: allOk ? "succeeded" : anyOk ? "partial" : "failed", finishedAt: new Date() }).where(eq(runs.id, run.id));

    // Stream lezárása
    event.node.res.end();
});
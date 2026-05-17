// server/api/runs/index.post.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from "~~/server/utils/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { runs, runModels, runOutputs, projects, messages, users } from "~~/server/database/schema";
import { chatCompletionStream } from "~~/server/utils/deepinfra";

const MAX_TOOL_DEPTH = 5;
const COST_FALLBACK_PER_TOKEN = 0.000002; // ~$2 per 1M tokens, adjust per model

const tools = [
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Read the exact content of a source code file from the imported GitHub repository.",
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The relative path to the file (e.g. src/main.ts)"
                    }
                },
                required: ["filePath"]
            }
        }
    }
];

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const body = await readBody(event);
    const {
        models,
        userInput,
        params,
        projectSlug,
        conversationId,
        systemPrompt,
        includeLocation
    } = body;

    if (!models?.length || !userInput || !projectSlug) {
        throw createError({
            statusCode: 400,
            message: "models, userInput, and projectSlug are required"
        });
    }

    // --- 1. CREDIT CHECK BEFORE RUN ---
    const [user] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));

    const currentCredits = Number(user?.credits || 0);

    if (!user || currentCredits <= 0) {
        throw createError({
            statusCode: 402,
            message: `ACCESS_DENIED: Insufficient credits. Current balance: ${currentCredits}`
        });
    }
    // -----------------------------------

    const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.slug, projectSlug), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw createError({ statusCode: 404, message: "Project not found" });
    }

    const projectDir = path.resolve(process.cwd(), '.storage', 'github', project.slug);

    let locationData: any = null;
    if (includeLocation) {
        try {
            let ip = getRequestIP(event, { xForwardedFor: true });
            if (ip?.startsWith('::ffff:')) {
                ip = ip.slice(7);
            }

            const isLocalIp =
                !ip ||
                ip === '::1' ||
                ip === '127.0.0.1' ||
                ip.startsWith('172.') ||
                ip.startsWith('192.168.') ||
                ip.startsWith('10.');

            if (!isLocalIp && ip) {
                const locRes = await fetch(`https://freeipapi.com/api/json/${ip}`);
                if (locRes.ok) {
                    const data = await locRes.json();
                    if (data.ipAddress) {
                        locationData = data;
                    }
                }
                console.log(locationData);
            }
        } catch (e) {
            console.error("Location fetch error", e);
        }
    }

    // --- PROCESS ATTACHMENT PLACEHOLDERS ---
    let processedInput = userInput;
    const attachmentRegex = /\[ATTACHMENT_STREAM: .*? \| PATH: (.*?)\]/g;
    const matches = [...userInput.matchAll(attachmentRegex)];

    for (const match of matches) {
        const relativePath = match[1];
        const cleanPath = relativePath.replace(/^\/+/, '');
        const resolvedPath = path.resolve(projectDir, cleanPath);

        // Fix #1: Path traversal guard
        if (!resolvedPath.startsWith(projectDir + path.sep) && resolvedPath !== projectDir) {
            processedInput = processedInput.replace(
                match[0],
                `\n[Access denied: invalid path: ${relativePath}]\n`
            );
            continue;
        }

        try {
            const fileContent = await fs.readFile(resolvedPath, 'utf-8');
            processedInput = processedInput.replace(
                match[0],
                `\n\n--- ATTACHED_FILE: ${relativePath} ---\n${fileContent}\n`
            );
        } catch {
            processedInput = processedInput.replace(
                match[0],
                `\n[File read error: ${relativePath}]\n`
            );
        }
    }

    // --- CREATE RUN RECORD ---
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

    const runModelsData = (models as string[]).map((modelName) => ({
        runId: run.id,
        modelName,
        status: "running"
    }));

    const insertedRunModels = await db.insert(runModels).values(runModelsData).returning();

    // --- BUILD HISTORY BEFORE INSERTING USER MESSAGE (Fix #2) ---
    let conversationHistory: any[] = [];
    if (conversationId) {
        conversationHistory = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(asc(messages.createdAt));
    }

    // --- NOW INSERT USER MESSAGE ---
    if (conversationId) {
        const metaJson = {
            timestamp: new Date().toISOString(),
            systemPrompt: systemPrompt || "Not provided",
            ...(locationData?.status === "success"
                ? { location: `${locationData.city}, ${locationData.country}` }
                : {})
        };

        await db.insert(messages).values({
            conversationId,
            sender: "user",
            content: userInput,
            metaJson
        });
    }

    // --- SSE HEADERS ---
    setHeader(event, 'Content-Type', 'text/event-stream');
    setHeader(event, 'Cache-Control', 'no-cache');
    setHeader(event, 'Connection', 'keep-alive');

    event.node.res.write(
        `data: ${JSON.stringify({ type: "init", runId: run.id })}\n\n`
    );

    // --- PARALLEL MODEL STREAMS ---
    await Promise.allSettled(
        insertedRunModels.map(async (rm) => {
            const t0 = Date.now();
            let fullText = "";
            let usageData: any = null;

            try {
                const aiMessages: any[] = [];

// 1. Dynamically build context for the system prompt
                let dynamicContext = `\n\n--- SYSTEM CONTEXT ---\nCurrent absolute time: ${new Date().toISOString()}`;

                if (locationData?.status === "success") {
                    dynamicContext += `\nUser's location: ${locationData.city}, ${locationData.country}`;
                }

// Combine it with the existing system prompt
                let finalSystemPrompt = (systemPrompt || "You are a helpful assistant.") + dynamicContext;
                if (finalSystemPrompt) {
                    aiMessages.push({ role: "system", content: finalSystemPrompt });
                }

// 3. Append history
                for (const msg of conversationHistory) {
                    aiMessages.push({
                        role: msg.sender === "user" ? "user" : "assistant",
                        content: msg.content
                    });
                }

// 4. Append current input
                aiMessages.push({ role: "user", content: processedInput });

                // Fix #3: void return, Fix #4: depth limit
                async function executeAIStream(
                    messagesArray: any[],
                    depth = 0
                ): Promise<void> {
                    if (depth > MAX_TOOL_DEPTH) {
                        const notice = "\n\n[Max tool call depth reached. Stopping.]\n\n";
                        fullText += notice;
                        event.node.res.write(
                            `data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: notice })}\n\n`
                        );
                        return;
                    }

                    console.log(
                        `[DEBUG] Model: ${rm.modelName}, Messages: ${messagesArray.length}, Depth: ${depth}`
                    );

                    const stream = await chatCompletionStream(
                        rm.modelName,
                        messagesArray,
                        { ...(params ?? {}), tools }
                    );

                    if (!stream) return;

                    const reader = stream.getReader();
                    const decoder = new TextDecoder("utf-8");

                    let loopText = "";
                    let toolCalls: any[] = [];

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunkText = decoder.decode(value, { stream: true });
                        const lines = chunkText
                            .split("\n")
                            .filter((line: string) => line.trim() !== "");

                        for (const line of lines) {
                            if (line.startsWith("data: ") && line !== "data: [DONE]") {
                                try {
                                    const data = JSON.parse(line.slice(6));

                                    if (data.usage) {
                                        usageData = data.usage;
                                    }

                                    const delta = data.choices?.[0]?.delta;
                                    if (!delta) continue;

                                    if (delta.content) {
                                        loopText += delta.content;
                                        fullText += delta.content;
                                        event.node.res.write(
                                            `data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: delta.content })}\n\n`
                                        );
                                    }

                                    if (delta.tool_calls) {
                                        for (const tc of delta.tool_calls) {
                                            const index = tc.index ?? 0;
                                            if (!toolCalls[index]) {
                                                toolCalls[index] = {
                                                    id: "",
                                                    type: "function",
                                                    function: { name: "", arguments: "" }
                                                };
                                            }
                                            if (tc.id) toolCalls[index].id = tc.id;
                                            if (tc.function?.name)
                                                toolCalls[index].function.name += tc.function.name;
                                            if (tc.function?.arguments)
                                                toolCalls[index].function.arguments += tc.function.arguments;
                                        }
                                    }
                                } catch {
                                    // Malformed SSE line — skip
                                }
                            }
                        }
                    }

                    if (toolCalls.length > 0) {
                        messagesArray.push({
                            role: "assistant",
                            content: loopText || null,
                            tool_calls: toolCalls
                        });

                        for (const tc of toolCalls) {
                            if (tc.function.name === "read_file") {
                                let fileContent = "";
                                try {
                                    const args = JSON.parse(tc.function.arguments);
                                    const cleanPath = String(args.filePath).replace(/^\/+/, '');
                                    const resolvedPath = path.resolve(projectDir, cleanPath);

                                    // Fix #1: Path traversal guard in tool call
                                    if (
                                        !resolvedPath.startsWith(projectDir + path.sep) &&
                                        resolvedPath !== projectDir
                                    ) {
                                        throw new Error("Path traversal detected");
                                    }

                                    const notice = `\n\n> 🔍 *[${rm.modelName}] Reading file: \`${args.filePath}\`*\n\n`;
                                    fullText += notice;
                                    event.node.res.write(
                                        `data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: notice })}\n\n`
                                    );

                                    fileContent = await fs.readFile(resolvedPath, 'utf-8');
                                } catch (err: any) {
                                    fileContent = `Error reading file: ${err.message}. The file may not exist or is inaccessible.`;
                                }

                                messagesArray.push({
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    name: tc.function.name,
                                    content: fileContent
                                });
                            }
                        }

                        await executeAIStream(messagesArray, depth + 1);
                    }
                }

                await executeAIStream(aiMessages);

                const latency = Date.now() - t0;

                // --- 2. ATOMIC CREDIT DEDUCTION (Fix #6) ---
                let cost = typeof usageData?.estimated_cost === 'number' && usageData.estimated_cost > 0
                    ? usageData.estimated_cost * 1.25
                    : (usageData?.total_tokens || 10) * COST_FALLBACK_PER_TOKEN;

                if (cost > 0) {
                    const deductResult = await db
                        .update(users)
                        .set({ credits: sql`${users.credits} - ${cost}` })
                        .where(
                            and(
                                eq(users.id, userId),
                                sql`${users.credits} >= ${cost}`
                            )
                        )
                        .returning({ newCredits: users.credits });

                    if (deductResult.length === 0) {
                        console.warn(`[WARN] Credit deduction failed for user ${userId} — insufficient balance at settlement.`);
                    }
                }
                // --------------------------------------------

                await db.insert(runOutputs).values({
                    runModelId: rm.id,
                    outputText: fullText,
                    rawResponseJson: usageData || {}
                });

                await db.update(runModels)
                    .set({ status: "succeeded", latencyMs: latency, finishedAt: new Date() })
                    .where(eq(runModels.id, rm.id));

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

                event.node.res.write(
                    `data: ${JSON.stringify({ type: "done", modelId: rm.id, usage: usageData })}\n\n`
                );

            } catch (err: any) {
                const latency = Date.now() - t0;
                await db.update(runModels)
                    .set({
                        status: "failed",
                        errorMessage: err.message,
                        latencyMs: latency,
                        finishedAt: new Date()
                    })
                    .where(eq(runModels.id, rm.id));

                event.node.res.write(
                    `data: ${JSON.stringify({ type: "error", modelId: rm.id, error: err.message })}\n\n`
                );
            }
        })
    );

    const statuses = await db
        .select({ status: runModels.status })
        .from(runModels)
        .where(eq(runModels.runId, run.id));

    const allOk = statuses.every((s) => s.status === "succeeded");
    const anyOk = statuses.some((s) => s.status === "succeeded");

    await db.update(runs)
        .set({
            status: allOk ? "succeeded" : anyOk ? "partial" : "failed",
            finishedAt: new Date()
        })
        .where(eq(runs.id, run.id));

    event.node.res.end();
});
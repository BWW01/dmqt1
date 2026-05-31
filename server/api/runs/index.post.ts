// server/api/runs/index.post.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from "~~/server/utils/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { runs, runModels, runOutputs, projects, messages, users, conversations } from "~~/server/database/schema";
import { chatCompletionStream } from "~~/server/utils/deepinfra";

const MAX_TOOL_DEPTH = 5;
const COST_FALLBACK_PER_TOKEN = 0.000002;
const CREDIT_UNIT = 1_000_000; // 1 credit = $0.000001

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
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: "List the files and subdirectories inside a directory of the imported GitHub repository. Use this to explore the repo structure before reading files.",
            parameters: {
                type: "object",
                properties: {
                    dirPath: {
                        type: "string",
                        description: "Relative path to the directory (e.g. src/components). Omit or pass '' for the repo root."
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: "Write content to a file in the imported GitHub repository. Creates the file (and any missing parent directories) if it doesn't exist, or overwrites it if it does.",
            parameters: {
                type: "object",
                properties: {
                    filePath: {
                        type: "string",
                        description: "The relative path to write to (e.g. src/utils/helper.ts)"
                    },
                    content: {
                        type: "string",
                        description: "The full content to write to the file"
                    }
                },
                required: ["filePath", "content"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_code",
            description: "Search for a regex pattern across all source files in the repository. Returns matching lines with file paths and line numbers. Skips node_modules and binary files.",
            parameters: {
                type: "object",
                properties: {
                    pattern: {
                        type: "string",
                        description: "The regex pattern to search for (e.g. 'useState|useEffect' or 'class MyComponent')"
                    },
                    dirPath: {
                        type: "string",
                        description: "Relative path to limit the search to a subdirectory. Omit to search the whole repo."
                    }
                },
                required: ["pattern"]
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
        includeLocation,
        attachments,
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
            if (ip) {
                const locRes = await fetch(`https://freeipapi.com/api/json/${ip}`);
                if (locRes.ok) {
                    const data = await locRes.json();
                    if (data.ipAddress) {
                        locationData = data;
                    }
                }
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

    // --- BUILD HISTORY BEFORE INSERTING USER MESSAGE ---
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
            ...(locationData?.cityName != null
                ? { location: `${locationData.cityName}, ${locationData.countryName}` }
                : {})
        };
        console.log(metaJson);
        await db.insert(messages).values({
            conversationId,
            sender: "user",
            content: userInput,
            metaJson
        });
        await db.update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));
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

                // ✅ Fixed: use correct condition and freeipapi field names
                if (locationData?.ipAddress) {
                    dynamicContext += `\nUser's location: ${locationData.cityName}, ${locationData.countryName}`;
                }

                // 2. Combine with the existing system prompt
                const finalSystemPrompt =
                    (systemPrompt || "You are a helpful assistant.") + dynamicContext;

                aiMessages.push({ role: "system", content: finalSystemPrompt });

                // 3. Append history
                for (const msg of conversationHistory) {
                    aiMessages.push({
                        role: msg.sender === "user" ? "user" : "assistant",
                        content: msg.content
                    });
                }

                // 4. Append current input (with attachments if any)
                const attachmentList: any[] = attachments || [];
                if (attachmentList.length > 0) {
                    const contentParts: any[] = [{ type: "text", text: processedInput }];
                    for (const att of attachmentList) {
                        if (att.mimeType?.startsWith('image/')) {
                            try {
                                const filename = String(att.url).split('/').pop() || '';
                                const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
                                const imageData = await fs.readFile(filePath);
                                const base64 = imageData.toString('base64');
                                contentParts.push({
                                    type: "image_url",
                                    image_url: { url: `data:${att.mimeType};base64,${base64}` }
                                });
                            } catch {
                                // fallback: send URL as-is
                                contentParts.push({ type: "image_url", image_url: { url: att.url } });
                            }
                        } else {
                            try {
                                const filename = String(att.url).split('/').pop() || '';
                                const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
                                const fileText = await fs.readFile(filePath, 'utf-8');
                                contentParts.push({
                                    type: "text",
                                    text: `\n\n--- ATTACHED_FILE: ${att.filename} ---\n${fileText}\n`
                                });
                            } catch { /* skip unreadable files */ }
                        }
                    }
                    aiMessages.push({ role: "user", content: contentParts });
                } else {
                    aiMessages.push({ role: "user", content: processedInput });
                }

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

                            } else if (tc.function.name === "list_directory") {
                                let result = "";
                                try {
                                    const args = JSON.parse(tc.function.arguments);
                                    const cleanPath = String(args.dirPath || '').replace(/^\/+/, '');
                                    const resolvedPath = cleanPath
                                        ? path.resolve(projectDir, cleanPath)
                                        : projectDir;

                                    if (
                                        !resolvedPath.startsWith(projectDir + path.sep) &&
                                        resolvedPath !== projectDir
                                    ) {
                                        throw new Error("Path traversal detected");
                                    }

                                    const notice = `\n\n> 📂 *[${rm.modelName}] Listing: \`/${cleanPath}\`*\n\n`;
                                    fullText += notice;
                                    event.node.res.write(
                                        `data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: notice })}\n\n`
                                    );

                                    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
                                    const lines = entries.map(e =>
                                        `${e.isDirectory() ? '[DIR] ' : '[FILE]'} ${e.name}`
                                    );
                                    result = `Contents of /${cleanPath}:\n${lines.join('\n')}`;
                                } catch (err: any) {
                                    result = `Error listing directory: ${err.message}`;
                                }

                                messagesArray.push({
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    name: tc.function.name,
                                    content: result
                                });

                            } else if (tc.function.name === "search_code") {
                                let result = "";
                                try {
                                    const args = JSON.parse(tc.function.arguments);
                                    const pattern = String(args.pattern);
                                    const cleanDir = String(args.dirPath || '').replace(/^\/+/, '');
                                    const resolvedDir = cleanDir
                                        ? path.resolve(projectDir, cleanDir)
                                        : projectDir;

                                    if (
                                        !resolvedDir.startsWith(projectDir + path.sep) &&
                                        resolvedDir !== projectDir
                                    ) {
                                        throw new Error("Path traversal detected");
                                    }

                                    const notice = `\n\n> 🔎 *[${rm.modelName}] Searching: \`${pattern}\`*\n\n`;
                                    fullText += notice;
                                    event.node.res.write(
                                        `data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: notice })}\n\n`
                                    );

                                    const regex = new RegExp(pattern, 'i');
                                    const matches: string[] = [];

                                    async function searchFiles(dir: string): Promise<void> {
                                        if (matches.length >= 50) return;
                                        const entries = await fs.readdir(dir, { withFileTypes: true });
                                        for (const entry of entries) {
                                            if (matches.length >= 50) break;
                                            const fullPath = path.join(dir, entry.name);
                                            if (entry.isDirectory()) {
                                                if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                                                    await searchFiles(fullPath);
                                                }
                                            } else {
                                                try {
                                                    const content = await fs.readFile(fullPath, 'utf-8');
                                                    const lines = content.split('\n');
                                                    for (let i = 0; i < lines.length && matches.length < 50; i++) {
                                                        if (regex.test(lines[i])) {
                                                            const relPath = path.relative(projectDir, fullPath);
                                                            matches.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                                                        }
                                                    }
                                                } catch { /* skip unreadable/binary files */ }
                                            }
                                        }
                                    }

                                    await searchFiles(resolvedDir);
                                    result = matches.length > 0
                                        ? `Found ${matches.length} match${matches.length === 1 ? '' : 'es'} for "${pattern}":\n\n${matches.join('\n')}`
                                        : `No matches found for "${pattern}"`;
                                } catch (err: any) {
                                    result = `Error searching: ${err.message}`;
                                }

                                messagesArray.push({
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    name: tc.function.name,
                                    content: result
                                });

                            } else if (tc.function.name === "write_file") {
                                let result = "";
                                try {
                                    const args = JSON.parse(tc.function.arguments);
                                    const cleanPath = String(args.filePath).replace(/^\/+/, '');
                                    const resolvedPath = path.resolve(projectDir, cleanPath);

                                    if (
                                        !resolvedPath.startsWith(projectDir + path.sep) &&
                                        resolvedPath !== projectDir
                                    ) {
                                        throw new Error("Path traversal detected");
                                    }

                                    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
                                    await fs.writeFile(resolvedPath, String(args.content), 'utf-8');

                                    const notice = `\n\n> ✏️ *[${rm.modelName}] Writing file: \`${args.filePath}\`*\n\n`;
                                    fullText += notice;
                                    event.node.res.write(
                                        `data: ${JSON.stringify({ type: "chunk", modelId: rm.id, text: notice })}\n\n`
                                    );

                                    result = `Successfully wrote ${String(args.content).length} characters to ${args.filePath}`;
                                } catch (err: any) {
                                    result = `Error writing file: ${err.message}`;
                                }

                                messagesArray.push({
                                    role: "tool",
                                    tool_call_id: tc.id,
                                    name: tc.function.name,
                                    content: result
                                });
                            }
                        }

                        await executeAIStream(messagesArray, depth + 1);
                    }
                }

                await executeAIStream(aiMessages);

                const latency = Date.now() - t0;

                // --- ATOMIC CREDIT DEDUCTION ---
                const dollarCost =
                    typeof usageData?.estimated_cost === "number" &&
                    usageData.estimated_cost > 0
                        ? usageData.estimated_cost * 1.25
                        : (usageData?.total_tokens || 10) * COST_FALLBACK_PER_TOKEN;
                const cost = Math.ceil(dollarCost * CREDIT_UNIT);

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
                        console.warn(
                            `[WARN] Credit deduction failed for user ${userId} — insufficient balance at settlement.`
                        );
                    }
                }
                // --------------------------------

                await db.insert(runOutputs).values({
                    runModelId: rm.id,
                    outputText: fullText,
                    rawResponseJson: usageData || {}
                });

                await db
                    .update(runModels)
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
                    await db.update(conversations)
                        .set({ updatedAt: new Date() })
                        .where(eq(conversations.id, conversationId));
                }

                event.node.res.write(
                    `data: ${JSON.stringify({ type: "done", modelId: rm.id, usage: usageData })}\n\n`
                );
            } catch (err: any) {
                const latency = Date.now() - t0;
                await db
                    .update(runModels)
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

    await db
        .update(runs)
        .set({
            status: allOk ? "succeeded" : anyOk ? "partial" : "failed",
            finishedAt: new Date()
        })
        .where(eq(runs.id, run.id));

    event.node.res.end();
});
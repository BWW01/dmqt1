// server/api/runs/index.get.ts
import { db } from "~~/server/utils/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { runs, runModels } from "~~/server/database/schema";

import { verifyPassword, signToken } from "~~/server/utils/auth";
import { chatCompletion, listModels } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }
    const query = getQuery(event);
    const projectId = query.projectId ? Number(query.projectId) : undefined;

    // 1. Build the dynamic where clause
    const conditions = [eq(runs.createdBy, userId)];
    if (projectId) {
        conditions.push(eq(runs.projectId, projectId));
    }

    // 2. Fetch the top 50 runs
    const userRuns = await db
        .select()
        .from(runs)
        .where(and(...conditions))
        .orderBy(desc(runs.createdAt))
        .limit(50);

    if (userRuns.length === 0) return [];

    const runIds = userRuns.map(r => r.id);

    // 3. Fetch the associated run models
    const relatedModels = await db
        .select({
            id: runModels.id,
            runId: runModels.runId,
            modelName: runModels.modelName,
            status: runModels.status,
            latencyMs: runModels.latencyMs,
        })
        .from(runModels)
        .where(inArray(runModels.runId, runIds));

    // 4. Map them together
    return userRuns.map(run => ({
        ...run,
        runModels: relatedModels.filter(m => m.runId === run.id)
    }));
});
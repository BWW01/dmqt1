// server/api/runs/[id].get.ts
import { db } from "~~/server/utils/db";
import { eq, and, asc } from "drizzle-orm";
import { runs, runModels, runOutputs } from "~~/server/database/schema";

import { verifyPassword, signToken } from "~~/server/utils/auth";
import { chatCompletion, listModels } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }
    const id = Number(getRouterParam(event, "id"));

    // Fetch flat relational data via SQL Joins
    const rows = await db
        .select({
            run: runs,
            runModel: runModels,
            output: runOutputs,
        })
        .from(runs)
        .leftJoin(runModels, eq(runModels.runId, runs.id))
        .leftJoin(runOutputs, eq(runOutputs.runModelId, runModels.id))
        .where(and(eq(runs.id, id), eq(runs.createdBy, userId)))
        .orderBy(asc(runModels.id));

    if (rows.length === 0) {
        throw createError({ statusCode: 404, message: "Run not found" });
    }

    // Reconstruct the nested JSON structure Prisma used to provide
    const runData = rows[0].run;
    const modelsMap = new Map();

    for (const row of rows) {
        if (row.runModel) {
            if (!modelsMap.has(row.runModel.id)) {
                modelsMap.set(row.runModel.id, {
                    ...row.runModel,
                    outputs: [],
                });
            }
            if (row.output) {
                modelsMap.get(row.runModel.id).outputs.push(row.output);
            }
        }
    }

    return {
        ...runData,
        runModels: Array.from(modelsMap.values()),
    };
});
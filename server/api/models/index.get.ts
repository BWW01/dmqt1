// server/api/models/index.get.ts
// Removed Prisma and Auth imports that were unused
import { listModels } from "~~/server/utils/deepinfra";

let cachedModels: any = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 perc

export default defineEventHandler(async () => {
    const now = Date.now();

    if (cachedModels && now - cacheTime < CACHE_TTL) {
        return cachedModels;
    }

    try {
        const result = await listModels();
        cachedModels = result;
        cacheTime = now;
        return result;
    } catch (err: any) {
        console.error("DeepInfra Fetch Error:", err);

        if (cachedModels) {
            return cachedModels;
        }
        throw createError({
            statusCode: 502,
            statusMessage: 'Bad Gateway',
            message: `Failed to fetch models: ${err.message}`,
            data: err
        });
    }
});
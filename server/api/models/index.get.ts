// server/api/models/index.get.ts
import type { Model } from '~/types/models';
import { listModels } from "~~/server/utils/deepinfra";

// ✅ EZEK HIÁNYOZTAK!
let cachedModels: Model[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

function detectCapabilities(modelId: string) {
    const id = modelId.toLowerCase();
    return {
        textGeneration: true,
        vision: id.includes('vision') ||
            id.includes('gpt-4-v') ||
            id.includes('claude-vision') ||
            id.includes('llava'),
        imageGeneration: id.includes('flux') ||
            id.includes('dall-e') ||
            id.includes('stable-diffusion') ||
            id.includes('sdxl'),
        audioInput: id.includes('whisper') ||
            id.includes('audio-in') ||
            id.includes('speech-to-text'),
        audioOutput: id.includes('tts') ||
            id.includes('audio-out') ||
            id.includes('text-to-speech')
    };
}


export default defineEventHandler(async (event): Promise<Model[]> => {
    const now = Date.now();

    if (cachedModels && now - cacheTime < CACHE_TTL) {
        return cachedModels;
    }

    try {
        const response = await listModels();
        const modelsList = response.data || response;

        const enriched: Model[] = modelsList.map((m: any) => ({
            id: m.id || m.model_name || '',
            model_name: m.name || m.model_name || m.id || '',
            capabilities: detectCapabilities(m.id || m.model_name || ''),
            pricing: m.metadata?.pricing ? {
                inputTokens: m.metadata.pricing.input_tokens,
                outputTokens: m.metadata.pricing.output_tokens,
                cacheReadTokens: m.metadata.pricing.cache_read_tokens
            } : undefined,
            // BONUS:
            description: m.metadata?.description,
            contextLength: m.metadata?.context_length,
            tags: m.metadata?.tags
        }));

        cachedModels = enriched;
        cacheTime = now;
        return enriched;
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
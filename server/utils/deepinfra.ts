// server/utils/deepinfra.ts
const BASE_URL = "https://api.deepinfra.com/v1/openai";

function getApiKey(): string {
    const config = useRuntimeConfig();
    const key = config.deepinfraApiKey;
    return key;
}

export async function listModels() {
    const res = await fetch(`${BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    if (!res.ok) {
        throw new Error(`DeepInfra models error: ${res.status}`);
    }
    return res.json();
}

export async function chatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    params: Record<string, unknown> = {},
    timeoutMs = 60_000,
) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${getApiKey()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ model, messages, ...params }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`DeepInfra ${res.status}: ${body}`);
        }

        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

export async function chatCompletionStream(
    model: string,
    messages: { role: string; content: string }[],
    params: Record<string, unknown> = {}
) {
    const fetch = globalThis.fetch;
    const res = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${getApiKey()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model,
            messages,
            ...params,
            stream: true,
            stream_options: { include_usage: true }
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`DeepInfra error: ${res.status} ${body}`);
    }

    return res.body;
}

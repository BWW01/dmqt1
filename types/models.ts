// types/models.ts
export interface Attachment {
    url: string;
    filename: string;
    mimeType: string;
}

export interface Model {
    id: string;
    model_name: string;
    capabilities: {
        textGeneration: boolean;
        vision: boolean;
        imageGeneration: boolean;
        audioInput: boolean;
        audioOutput: boolean;
    };
    pricing?: {
        inputTokens: number;      // per million tokens
        outputTokens: number;
        cacheReadTokens?: number;
    };
}
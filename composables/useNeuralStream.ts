// composables/useNeuralStream.ts
import { ref, type Ref } from 'vue';
import type { Attachment } from '~/types/models';

export function useNeuralStream(
    projectSlug: Ref<string>,
    selectedConversationId: Ref<number | null>,
    selectedModels: Ref<string[]>,
    messages: Ref<any[]>,
    uploadedImages: Ref<Attachment[]>,
    loadMessages: () => Promise<void>
) {
    const { $api } = useApi();

    // --- AUTH COMPOSABLE BEHÍVÁSA ---
    const { fetchMe } = useAuth();

    // 1. JAVÍTÁS: A cookie-t itt, a gyökérben kell lekérni!
    const token = useCookie("dmqt_token");

    // Input állapotok
    const mqInput = ref("");
    const systemPrompt = ref("");
    const temperature = ref(0.7);
    const topP = ref(0.9);
    const maxTokens = ref(2048);
    const includeLocation = ref(false);

    // Futtatási állapotok
    const polling = ref(false);
    const runResult = ref<any>(null);
    const streamingRun = ref<any>(null);

    async function startRun() {
        if (
            !selectedModels.value.length ||
            (!mqInput.value.trim() && !uploadedImages.value.length)
        ) return;

        if (!selectedConversationId.value) {
            alert("Kérlek előbb válassz ki, vagy indíts egy új Sequence-t (bal oldalt) a mentéshez!");
            return;
        }

        polling.value = true;
        runResult.value = null;
        streamingRun.value = null;

        // Optimista UI frissítés
        const tempMessage = {
            id: `temp_${Date.now()}`,
            sender: "user",
            content: mqInput.value,
            metaJson: {
                timestamp: new Date().toISOString(),
                location: includeLocation.value ? "Lekérdezés alatt..." : undefined,
                systemPrompt: systemPrompt.value
            }
        };
        messages.value.push(tempMessage);

        try {
            const bodyPayload = {
                userInput: mqInput.value,
                attachments: uploadedImages.value,
                models: selectedModels.value,
                projectSlug: projectSlug.value,
                conversationId: selectedConversationId.value,
                systemPrompt: systemPrompt.value,
                includeLocation: includeLocation.value,
                params: {
                    temperature: temperature.value,
                    top_p: topP.value,
                    max_tokens: maxTokens.value
                }
            };

            uploadedImages.value = [];
            mqInput.value = "";

            const response = await fetch("/api/runs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // 2. JAVÍTÁS: Itt már csak a változó értékét olvassuk ki
                    "Authorization": `Bearer ${token.value}`
                },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.body) throw new Error("Nem érkezett adatfolyam");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split("\n").filter(line => line.trim() !== "");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === "init") {
                                streamingRun.value = await $api(`/api/runs/${data.runId}`);
                                streamingRun.value.runModels.forEach((rm: any) => {
                                    if (!rm.outputs || rm.outputs.length === 0) {
                                        rm.outputs = [{ id: `temp_${rm.id}`, outputText: '' }];
                                    }
                                });
                            } else if (data.type === "chunk" && streamingRun.value) {
                                const rm = streamingRun.value.runModels.find((m: any) => m.id === data.modelId);
                                if (rm && rm.outputs && rm.outputs.length > 0) {
                                    rm.outputs[0].outputText += data.text;
                                }
                            } else if (data.type === "done" && streamingRun.value) {
                                const rm = streamingRun.value.runModels.find((m: any) => m.id === data.modelId);
                                if (rm) {
                                    rm.status = 'succeeded';
                                    if (data.usage) rm.usage = data.usage;
                                }
                            } else if (data.type === "error" && streamingRun.value) {
                                const rm = streamingRun.value.runModels.find((m: any) => m.id === data.modelId);
                                if (rm) {
                                    rm.status = 'failed';
                                    rm.errorMessage = data.error;
                                }
                            }
                        } catch (e) {}
                    }
                }
            }

            polling.value = false;

            // --- ÚJ SOR: Frissítjük az egyenleget a fejlécben ---
            await fetchMe();
            // -----------------------------------------------------

            if (selectedConversationId.value) {
                runResult.value = null;
                streamingRun.value = null;
                await loadMessages();
            } else {
                runResult.value = streamingRun.value;
                streamingRun.value = null;
            }

        } catch (e) {
            console.error("Futás hiba:", e);
            polling.value = false;

            // --- ÚJ SOR: Hiba esetén (pl. nincs kredit) is frissítjük a kijelzést ---
            await fetchMe();
            // ------------------------------------------------------------------------
        }
    }

    return {
        mqInput, systemPrompt, temperature, topP, maxTokens, includeLocation,
        polling, runResult, streamingRun, startRun
    };
}
// composables/useAIModels.ts
import { ref } from 'vue';

export function useAIModels() {
    const { $api } = useApi();

    const models = ref<any[]>([]);
    const selectedModels = ref<string[]>([]);

    async function loadModels() {
        try {
            const data = await $api<any>("/api/models");
            models.value = data.data || data;
        } catch (e) {
            console.error("Failed to load models:", e);
        }
    }

    return {
        models,
        selectedModels,
        loadModels
    };
}
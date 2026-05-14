// composables/useWorkspace.ts
import { ref, type Ref } from 'vue';

export function useWorkspace(projectSlug: Ref<string>) {
    const { $api } = useApi();

    const project = ref<any>(null);
    const conversations = ref<any[]>([]);
    const selectedConversationId = ref<number | null>(null);
    const messages = ref<any[]>([]);
    const newConvTitle = ref("");

    async function loadProject() {
        try {
            project.value = await $api(`/api/projects/${projectSlug.value}`);
            conversations.value = project.value.conversations ?? [];
        } catch (e) {
            console.error("Failed to load project:", e);
        }
    }

    async function loadMessages() {
        if (!selectedConversationId.value) return;
        try {
            messages.value = await $api(
                `/api/conversations/${selectedConversationId.value}/messages`,
            );
        } catch (e) {
            console.error("Failed to load messages:", e);
        }
    }

    async function createConversation() {
        const title = newConvTitle.value.trim() || `SEQ_${Math.floor(Math.random() * 10000)}`;
        try {
            const conv = await $api<any>(
                `/api/projects/${projectSlug.value}/conversations`,
                { method: "POST", body: { title } },
            );
            newConvTitle.value = "";
            await loadProject();
            selectedConversationId.value = conv.id;
            await loadMessages();
        } catch (e) {
            alert("CONV_INIT_FAILED");
        }
    }

    return {
        project,
        conversations,
        selectedConversationId,
        messages,
        newConvTitle,
        loadProject,
        loadMessages,
        createConversation
    };
}
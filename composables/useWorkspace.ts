// composables/useWorkspace.ts
import { ref, type Ref } from 'vue';

export function useWorkspace(projectSlug: Ref<string>) {
    const { $api } = useApi();
    const token = useCookie("dmqt_token");

    const project = ref<any>(null);
    const conversations = ref<any[]>([]);
    const selectedConversationId = ref<number | null>(null);
    const messages = ref<any[]>([]);
    const newConvTitle = ref("");

    const convStreamText = ref("");
    const isConvStreaming = ref(false);

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

    async function sendMessage(content: string, model?: string) {
        if (!selectedConversationId.value || isConvStreaming.value) return;

        isConvStreaming.value = true;
        convStreamText.value = "";

        messages.value.push({
            id: `temp_${Date.now()}`,
            sender: "user",
            content,
            createdAt: new Date().toISOString(),
            metaJson: null,
        });

        try {
            const response = await fetch(
                `/api/conversations/${selectedConversationId.value}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token.value}`,
                    },
                    body: JSON.stringify({ content, model }),
                }
            );

            if (!response.body) throw new Error("No stream");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                for (const line of text.split("\n").filter(l => l.trim())) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "chunk") convStreamText.value += data.text;
                        if (data.type === "done" || data.type === "error") {
                            await loadMessages();
                            convStreamText.value = "";
                        }
                    } catch { /* skip malformed */ }
                }
            }
        } catch (e) {
            console.error("Conversation stream error:", e);
            convStreamText.value = "";
        } finally {
            isConvStreaming.value = false;
        }
    }

    return {
        project,
        conversations,
        selectedConversationId,
        messages,
        newConvTitle,
        convStreamText,
        isConvStreaming,
        loadProject,
        loadMessages,
        createConversation,
        sendMessage,
    };
}

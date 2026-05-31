// composables/useAttachments.ts
import { ref } from 'vue';
import type { Attachment } from '~/types/models';

export function useAttachments() {
    const { $api } = useApi();

    const uploadedImages = ref<Attachment[]>([]);
    const uploadLoading = ref(false);

    async function handleFileUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        if (!target.files?.length) return;

        uploadLoading.value = true;
        try {
            for (const file of Array.from(target.files)) {
                const formData = new FormData();
                formData.append("file", file);

                const response = await $api<{ url: string; filename: string }>("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                uploadedImages.value.push({
                    url: response.url,
                    filename: file.name,
                    mimeType: file.type || 'application/octet-stream',
                });
            }
        } catch (e) {
            alert("UPLOAD_FAILED");
        } finally {
            uploadLoading.value = false;
            target.value = "";
        }
    }

    return {
        uploadedImages,
        uploadLoading,
        handleFileUpload
    };
}

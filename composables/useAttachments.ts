// composables/useAttachments.ts
import { ref } from 'vue';

export function useAttachments() {
    const { $api } = useApi();

    const uploadedImages = ref<string[]>([]);
    const uploadLoading = ref(false);

    async function handleFileUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        if (!target.files?.length) return;

        const formData = new FormData();
        formData.append("file", target.files[0]);

        uploadLoading.value = true;
        try {
            const response = await $api<{ url: string }>("/api/upload", {
                method: "POST",
                body: formData,
            });
            const fullUrl = response.url.startsWith("http")
                ? response.url
                : `http://localhost:3000${response.url}`;
            uploadedImages.value.push(fullUrl);
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
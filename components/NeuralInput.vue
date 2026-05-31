<script setup lang="ts">
import type { Attachment } from '~/types/models';

defineProps<{
  uploadLoading: boolean;
  polling: boolean;
  uploadedImages: Attachment[];
}>();

const emit = defineEmits<{
  upload: [event: Event];
  execute: [];
  removeImage: [index: number];
}>();

const mqInput = defineModel<string>("mqInput", { required: true });

function isImage(att: Attachment) {
  return att.mimeType.startsWith('image/');
}
</script>

<template>
  <div class="relative group">
    <div class="absolute -top-2 left-4 bg-stone-100 px-2 text-[9px] text-green-700 font-black z-10">
      QUERY_INPUT_BUFFER
    </div>
    <textarea
        v-model="mqInput"
        placeholder="ENTER_NEURAL_QUERY_OR_INSTRUCTION..."
        class="w-full h-30 bg-white border-2 border-stone-300 text-stone-800 p-4 text-sm focus:border-green-600 outline-none transition-colors font-mono custom-scrollbar"
    ></textarea>

    <div v-if="uploadedImages.length > 0" class="flex flex-wrap gap-3 p-3 bg-stone-50 border-x border-stone-300">
      <div v-for="(att, index) in uploadedImages" :key="index" class="relative group">
        <!-- Image preview -->
        <div v-if="isImage(att)" class="w-24 h-24 border border-stone-300 hover:border-green-600 transition-colors">
          <img :src="att.url" class="w-full h-full object-cover" :alt="att.filename" />
        </div>
        <!-- Non-image file badge -->
        <div v-else class="flex items-center gap-1 px-3 py-2 border border-stone-300 hover:border-green-600 bg-white transition-colors max-w-[160px]">
          <span class="text-[9px] font-black text-green-700 uppercase">FILE</span>
          <span class="text-[10px] text-stone-600 truncate">{{ att.filename }}</span>
        </div>
        <button
            @click="emit('removeImage', index)"
            class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center hover:bg-red-600 font-black shadow-lg"
        >X</button>
      </div>
    </div>

    <div class="flex justify-between items-center mt-0 bg-stone-50 p-2 border border-stone-300">
      <label class="btn-industrial px-10 py-2 text-sm font-black disabled:opacity-30 flex items-center gap-2">
        <span v-if="uploadLoading" class="w-2 h-2 bg-green-300 animate-pulse rounded-full"></span>
        {{ uploadLoading ? "UPLOADING..." : "[ ATTACH_FILE ]" }}
        <input type="file" class="hidden" multiple @change="(e) => emit('upload', e)" :disabled="uploadLoading" />
      </label>
      <button
          @click="emit('execute')"
          :disabled="polling || (!mqInput && uploadedImages.length === 0)"
          class="btn-industrial px-10 py-2 text-sm font-black disabled:opacity-30 flex items-center gap-2"
      >
        <span v-if="polling" class="w-2 h-2 bg-green-300 animate-pulse rounded-full"></span>
        {{ polling ? "STREAMING_DATA..." : "EXECUTE_RUN" }}
      </button>
    </div>
  </div>
</template>

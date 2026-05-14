<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  models: any[];
}>();

const selected = defineModel<string[]>({ required: true });
const search = ref("");

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return props.models;
  return props.models.filter((m: any) =>
      (m.id || m.model_name || "").toLowerCase().includes(q),
  );
});

function toggle(id: string) {
  const idx = selected.value.indexOf(id);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
  } else {
    selected.value.push(id);
  }
}
</script>

<template>
  <div class="font-mono">
    <div class="flex justify-between items-end mb-2">
      <label class="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
        // Target_Models
      </label>
      <span class="text-xs text-red-600 font-bold">[{{ selected.length }} SELECTED]</span>
    </div>

    <input
        v-model="search"
        placeholder="Filter models..."
        class="w-full bg-black border border-zinc-800 text-zinc-300 px-3 py-2 text-xs mb-3 focus:outline-none focus:border-red-600 transition-colors placeholder-zinc-700"
    />

    <div class="h-48 overflow-y-auto border border-zinc-900 bg-black p-1 space-y-[2px] custom-scrollbar">
      <label
          v-for="m in filtered"
          :key="m.id || m.model_name"
          class="flex items-center gap-3 text-xs cursor-pointer p-2 transition-colors border-l-2"
          :class="selected.includes(m.id || m.model_name) ? 'bg-red-950/40 border-red-600 text-red-500' : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'"
      >
        <div
            class="w-3 h-3 border border-zinc-600 flex items-center justify-center transition-colors"
            :class="{ 'border-red-500 bg-red-600': selected.includes(m.id || m.model_name) }"
        >
          <div v-if="selected.includes(m.id || m.model_name)" class="w-1.5 h-1.5 bg-black"></div>
        </div>

        <span class="truncate font-bold">{{ (m.id || m.model_name).split('/').pop() }}</span>
      </label>

      <div v-if="filtered.length === 0" class="text-red-900 text-xs text-center py-4 uppercase font-bold tracking-widest">
        NO_MODELS_FOUND
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: Make the scrollbar look industrial */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #000;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3f3f46;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #dc2626;
}
</style>
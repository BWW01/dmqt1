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
  <div class="font-mono bg-stone-50 border border-stone-300 p-3 shadow-md">
    <div class="flex justify-between items-end mb-3">
      <label
          class="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em]"
      >
        // ACTIVE_REGISTRY
      </label>
      <span class="text-[10px] text-green-700 font-black"
      >[{{ selected.length }} ATTACHED]</span
      >
    </div>

    <div class="relative mb-4">
      <input
          v-model="search"
          placeholder="SEARCH_ID..."
          class="w-full bg-white border border-stone-300 text-stone-700 px-3 py-2 text-xs focus:outline-none focus:border-green-600 transition-colors placeholder-stone-400"
      />
      <div class="absolute right-3 top-2.5 w-1 h-3 bg-green-600/30"></div>
    </div>

    <div
        class="h-64 overflow-y-auto border border-stone-300 bg-stone-50 p-1 space-y-[2px] custom-scrollbar"
    >
      <label
          v-for="m in filtered"
          :key="m.id || m.model_name"
          class="group flex items-center gap-3 text-[11px] cursor-pointer p-2 transition-all border-l-2"
          :class="
          selected.includes(m.id || m.model_name)
            ? 'bg-green-50 border-green-600 text-green-700'
            : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
        "
      >
        <div
            class="w-3 h-3 border border-stone-400 flex items-center justify-center transition-all group-hover:border-stone-600"
            :class="{
            'border-green-600 bg-green-100': selected.includes(
              m.id || m.model_name,
            ),
          }"
        >
          <div
              v-if="selected.includes(m.id || m.model_name)"
              class="w-1.5 h-1.5 bg-green-600"
          ></div>
        </div>

        <span class="truncate font-bold tracking-tight uppercase">{{
            (m.id || m.model_name).split("/").pop()
          }}</span>
      </label>

      <div
          v-if="filtered.length === 0"
          class="text-stone-400 text-[10px] text-center py-8 uppercase font-black tracking-widest italic"
      >
        ERR: NO_RECORDS_LOCATED
      </div>
    </div>
  </div>
</template>
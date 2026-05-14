<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  models: any[];
}>();

const selected = defineModel<string[]>({ required: true });
const search = ref("");

// 1. Lépés: Keresés szerinti szűrés
const filtered = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return props.models;
  return props.models.filter((m: any) =>
      (m.id || m.model_name || "").toLowerCase().includes(q),
  );
});

// 2. Lépés: A szűrt lista csoportosítása a "/" jel alapján
const groupedModels = computed(() => {
  const groups: Record<string, any[]> = {};

  filtered.value.forEach(m => {
    const id = m.id || m.model_name || "";
    const parts = id.split('/');
    const category = parts.length > 1 ? parts[0] : 'uncategorized';

    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(m);
  });

  return groups;
});
</script>

<template>
  <div class="font-mono bg-stone-50 border border-stone-300 p-3 shadow-md">
    <div class="flex justify-between items-end mb-3">
      <label class="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em]">
        // ACTIVE_REGISTRY
      </label>
      <span class="text-[10px] text-green-700 font-black">
        [{{ selected.length }} ATTACHED]
      </span>
    </div>

    <div class="relative mb-4">
      <input
          v-model="search"
          placeholder="SEARCH_ID..."
          class="w-full bg-white border border-stone-300 text-stone-700 px-3 py-2 text-xs focus:outline-none focus:border-green-600 transition-colors placeholder-stone-400"
      />
      <div class="absolute right-3 top-2.5 w-1 h-3 bg-green-600/30"></div>
    </div>

    <div class="h-64 overflow-y-auto border border-stone-300 bg-stone-50 p-1 space-y-3 custom-scrollbar">

      <div v-for="(group, category) in groupedModels" :key="category">
        <div class="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1 border-b border-stone-200 pb-1 ml-1">
          // {{ category }}
        </div>

        <div class="space-y-[2px]">
          <label
              v-for="m in group"
              :key="m.id || m.model_name"
              class="group flex items-center gap-3 text-[11px] cursor-pointer p-2 transition-all border-l-2"
              :class="
              selected.includes(m.id || m.model_name)
                ? 'bg-green-50 border-green-600 text-green-700'
                : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
            "
          >
            <input type="checkbox" :value="m.id || m.model_name" v-model="selected" class="hidden" />

            <div
                class="w-3 h-3 border flex items-center justify-center transition-all group-hover:border-stone-600"
                :class="selected.includes(m.id || m.model_name) ? 'border-green-600 bg-green-100' : 'border-stone-400'"
            >
              <div v-if="selected.includes(m.id || m.model_name)" class="w-1.5 h-1.5 bg-green-600"></div>
            </div>

            <span class="truncate font-bold tracking-tight uppercase">
              {{ (m.id || m.model_name).split("/").pop() }}
            </span>
          </label>
        </div>
      </div>

      <div
          v-if="filtered.length === 0"
          class="text-stone-400 text-[10px] text-center py-8 uppercase font-black tracking-widest italic"
      >
        ERR: NO_RECORDS_LOCATED
      </div>
    </div>
  </div>
</template>
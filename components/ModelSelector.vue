<script setup lang="ts">
import { ref, computed } from 'vue';
import { Eye, Wand2, Mic, Volume2 } from 'lucide-vue-next';
import type { Model } from '~/types/models';

const props = defineProps<{
  models: Model[];
}>();

const selected = defineModel<string[]>({ required: true });
const search = ref("");

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return props.models;
  return props.models.filter((m: Model) =>
      (m.id || m.model_name || "").toLowerCase().includes(q)
  );
});

const groupedModels = computed(() => {
  const groups: Record<string, Model[]> = {};

  filtered.value.forEach((m: Model) => {
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

const capabilityConfig = {
  vision: { icon: Eye, color: 'text-blue-700', bg: 'bg-blue-100' },
  imageGeneration: { icon: Wand2, color: 'text-purple-700', bg: 'bg-purple-100' },
  audioInput: { icon: Mic, color: 'text-orange-700', bg: 'bg-orange-100' },
  audioOutput: { icon: Volume2, color: 'text-amber-700', bg: 'bg-amber-100' },
};


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
              :key="m.id"
              class="group flex items-center gap-3 text-[11px] cursor-pointer p-2 transition-all border-l-2"
              :class="
    selected.includes(m.id)
      ? 'bg-green-50 border-green-600 text-green-700'
      : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
  "
          >
            <input
                type="checkbox"
                :value="m.id"
                v-model="selected"
                class="hidden"
            />

            <div
                class="w-3 h-3 border flex items-center justify-center transition-all group-hover:border-stone-600"
                :class="
      selected.includes(m.id)
        ? 'border-green-600 bg-green-100'
        : 'border-stone-400'
    "
            >
              <div
                  v-if="selected.includes(m.id)"
                  class="w-1.5 h-1.5 bg-green-600"
              ></div>
            </div>

            <span class="truncate font-bold tracking-tight uppercase">
    {{ (m.id || m.model_name).split("/").pop() }}
  </span>

            <!-- Capability icons + Pricing wrapper -->
            <div class="flex gap-2 ml-auto flex-shrink-0 items-center">
              <!-- Icons -->
              <div class="flex gap-2">
                <component
                    v-if="m.capabilities.vision"
                    :is="capabilityConfig.vision.icon"
                    class="w-4 h-4 text-blue-700"
                    title="Vision"
                />
                <component
                    v-if="m.capabilities.imageGeneration"
                    :is="capabilityConfig.imageGeneration.icon"
                    class="w-4 h-4 text-purple-700"
                    title="Image Generation"
                />
                <component
                    v-if="m.capabilities.audioInput"
                    :is="capabilityConfig.audioInput.icon"
                    class="w-4 h-4 text-orange-700"
                    title="Audio Input"
                />
                <component
                    v-if="m.capabilities.audioOutput"
                    :is="capabilityConfig.audioOutput.icon"
                    class="w-4 h-4 text-amber-700"
                    title="Audio Output"
                />
              </div>

              <!-- Pricing -->
              <div v-if="m.pricing?.inputTokens != null" class="text-[11px] text-stone-400 whitespace-nowrap pl-2 border-l border-stone-200">
                {{ m.pricing.inputTokens.toFixed(5) }} / 1M
              </div>
            </div>
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

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d4d4d8;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #a1a1aa;
}
</style>
<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ runData: any }>();

type TabId = number | 'all';
const activeTab = ref<TabId>('all');
const copiedId = ref<number | null>(null);

const models = computed(() => props.runData?.runModels ?? []);
const showTabs = computed(() => models.value.length > 1);

const activeModel = computed(() =>
  typeof activeTab.value === 'number'
    ? models.value.find((m: any) => m.id === activeTab.value) ?? null
    : null
);

function copyOutput(rm: any) {
  const text = (rm.outputs ?? []).map((o: any) => o.outputText ?? '').join('\n').trim();
  navigator.clipboard.writeText(text);
  copiedId.value = rm.id;
  setTimeout(() => { copiedId.value = null; }, 1500);
}

function statusDot(status: string) {
  if (status === 'running') return 'bg-orange-500 animate-pulse';
  if (status === 'succeeded') return 'bg-green-500';
  return 'bg-red-500';
}
</script>

<template>
  <div class="animate-in fade-in duration-500 space-y-0">
    <div class="flex items-center gap-2 mb-4">
      <div class="h-[1px] flex-1 bg-zinc-800"></div>
      <span class="text-[10px] font-black text-zinc-600 uppercase">Latest_Execution_Results</span>
      <div class="h-[1px] flex-1 bg-zinc-800"></div>
    </div>

    <!-- Tab bar (only when 2+ models) -->
    <div v-if="showTabs" class="flex border-b border-zinc-700 mb-0 overflow-x-auto">
      <!-- ALL tab -->
      <button
          @click="activeTab = 'all'"
          :class="[
            'flex-none px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap',
            activeTab === 'all'
              ? 'border-orange-500 text-orange-400 bg-orange-950/30'
              : 'border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50'
          ]"
      >
        ⊞ ALL
      </button>

      <!-- Per-model tabs -->
      <button
          v-for="rm in models"
          :key="rm.id"
          @click="activeTab = rm.id"
          :class="[
            'flex-none px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
            activeTab === rm.id
              ? 'border-orange-500 text-orange-400 bg-orange-950/30'
              : 'border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50'
          ]"
      >
        <span class="w-1.5 h-1.5 rounded-full flex-none" :class="statusDot(rm.status)"></span>
        {{ rm.modelName.split('/').pop() }}
      </button>
    </div>

    <!-- ALL view: side-by-side grid -->
    <div
        v-if="!showTabs || activeTab === 'all'"
        :class="[
          'grid gap-4 pt-4',
          models.length === 1 ? 'grid-cols-1' :
          models.length === 2 ? 'grid-cols-2' :
          'grid-cols-2 xl:grid-cols-3'
        ]"
    >
      <div
          v-for="rm in models"
          :key="rm.id"
          class="border border-zinc-700 bg-zinc-900 relative overflow-hidden flex flex-col"
      >
        <div v-if="rm.status === 'running'" class="absolute top-0 left-0 h-[2px] bg-orange-500 animate-pulse w-full"></div>

        <div class="flex-none px-4 pt-3 pb-2 border-b border-zinc-800 flex items-start justify-between gap-2">
          <div>
            <div class="text-[9px] text-zinc-300 font-mono font-black uppercase truncate mb-1">
              {{ rm.modelName.split('/').pop() }}
            </div>
            <div class="text-[9px] text-zinc-600 font-mono flex gap-3 flex-wrap items-center">
              <span :class="rm.status === 'succeeded' ? 'text-orange-400' : rm.status === 'failed' ? 'text-red-400' : 'text-zinc-500'">
                {{ rm.status.toUpperCase() }}
              </span>
              <span v-if="rm.latencyMs">{{ rm.latencyMs }}ms</span>
              <template v-if="rm.usage">
                <span class="text-amber-500 font-bold">${{ (rm.usage.cost ?? rm.usage.estimated_cost ?? 0).toFixed(6) }}</span>
                <span>{{ rm.usage.total_tokens }} tok</span>
              </template>
            </div>
          </div>
          <button
              @click="copyOutput(rm)"
              class="flex-none text-[9px] uppercase tracking-widest font-black px-2 py-1 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 transition-colors text-zinc-500 whitespace-nowrap"
          >
            {{ copiedId === rm.id ? 'COPIED!' : 'COPY' }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar p-4" style="max-height: 420px;">
          <div v-for="out in rm.outputs" :key="out.id" class="text-sm text-zinc-100 leading-relaxed font-sans">
            <MarkdownContent :content="out.outputText || ''" />
            <span v-if="rm.status === 'running'" class="inline-block w-2 h-4 bg-orange-500 animate-pulse ml-1 align-middle opacity-70"></span>
          </div>
          <div v-if="rm.errorMessage" class="text-xs text-red-400 font-bold bg-red-950 p-3 border border-red-900 mt-3">
            > ERR: {{ rm.errorMessage }}
          </div>
        </div>
      </div>
    </div>

    <!-- Single model focused view -->
    <div v-else-if="activeModel" class="pt-4">
      <div class="border border-zinc-700 bg-zinc-900 relative overflow-hidden flex flex-col">
        <div v-if="activeModel.status === 'running'" class="absolute top-0 left-0 h-[2px] bg-orange-500 animate-pulse w-full"></div>

        <div class="flex-none px-4 pt-3 pb-2 border-b border-zinc-800 flex items-start justify-between gap-2">
          <div>
            <div class="text-[11px] text-zinc-100 font-mono font-black uppercase mb-1">
              {{ activeModel.modelName }}
            </div>
            <div class="text-[9px] text-zinc-600 font-mono flex gap-3 flex-wrap items-center">
              <span :class="activeModel.status === 'succeeded' ? 'text-orange-400' : activeModel.status === 'failed' ? 'text-red-400' : 'text-zinc-500'">
                {{ activeModel.status.toUpperCase() }}
              </span>
              <span v-if="activeModel.latencyMs">{{ activeModel.latencyMs }}ms</span>
              <template v-if="activeModel.usage">
                <span class="text-amber-500 font-bold">${{ (activeModel.usage.cost ?? activeModel.usage.estimated_cost ?? 0).toFixed(6) }}</span>
                <span>{{ activeModel.usage.total_tokens }} tok</span>
              </template>
            </div>
          </div>
          <button
              @click="copyOutput(activeModel)"
              class="flex-none text-[9px] uppercase tracking-widest font-black px-2 py-1 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 transition-colors text-zinc-500 whitespace-nowrap"
          >
            {{ copiedId === activeModel.id ? 'COPIED!' : 'COPY' }}
          </button>
        </div>

        <div class="overflow-y-auto overflow-x-auto custom-scrollbar p-6" style="max-height: 600px;">
          <div v-for="out in activeModel.outputs" :key="out.id" class="text-sm text-zinc-100 leading-relaxed font-sans">
            <MarkdownContent :content="out.outputText || ''" />
            <span v-if="activeModel.status === 'running'" class="inline-block w-2 h-4 bg-orange-500 animate-pulse ml-1 align-middle opacity-70"></span>
          </div>
          <div v-if="activeModel.errorMessage" class="text-xs text-red-400 font-bold bg-red-950 p-3 border border-red-900 mt-3">
            > ERR: {{ activeModel.errorMessage }}
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

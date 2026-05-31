<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ runData: any }>();

const copiedId = ref<number | null>(null);

function copyOutput(rm: any) {
  const text = (rm.outputs ?? []).map((o: any) => o.outputText ?? '').join('\n').trim();
  navigator.clipboard.writeText(text);
  copiedId.value = rm.id;
  setTimeout(() => { copiedId.value = null; }, 1500);
}
</script>

<template>
  <div class="animate-in fade-in duration-500 space-y-4">
    <div class="flex items-center gap-2">
      <div class="h-[1px] flex-1 bg-zinc-800"></div>
      <span class="text-[10px] font-black text-zinc-600 uppercase">Latest_Execution_Results</span>
      <div class="h-[1px] flex-1 bg-zinc-800"></div>
    </div>

    <div :class="[
      'grid gap-4',
      runData.runModels.length === 1 ? 'grid-cols-1' :
      runData.runModels.length === 2 ? 'grid-cols-2' :
      'grid-cols-2 xl:grid-cols-3'
    ]">
      <div
          v-for="rm in runData.runModels"
          :key="rm.id"
          class="border border-zinc-700 bg-zinc-900 relative overflow-hidden flex flex-col"
      >
        <div v-if="rm.status === 'running'" class="absolute top-0 left-0 h-[2px] bg-orange-500 animate-pulse w-full"></div>

        <!-- Header -->
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

        <!-- Scrollable output -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-4" style="max-height: 520px;">
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
  </div>
</template>

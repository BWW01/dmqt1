<script setup lang="ts">
defineProps<{ runData: any }>();
</script>

<template>
  <div class="animate-in fade-in duration-500 space-y-4">
    <div class="flex items-center gap-2">
      <div class="h-[1px] flex-1 bg-stone-300"></div>
      <span class="text-[10px] font-black text-stone-500 uppercase">Latest_Execution_Results</span>
      <div class="h-[1px] flex-1 bg-stone-300"></div>
    </div>

    <div :class="[
      'grid gap-4',
      runData.runModels.length === 1 ? 'grid-cols-1' :
      runData.runModels.length === 2 ? 'grid-cols-2' :
      'grid-cols-2 xl:grid-cols-3'
    ]">
      <div v-for="rm in runData.runModels" :key="rm.id" class="border border-stone-300 bg-white relative overflow-hidden flex flex-col">
        <div v-if="rm.status === 'running'" class="absolute top-0 left-0 h-1 bg-green-600 animate-pulse w-full"></div>

        <!-- Header -->
        <div class="flex-none px-4 pt-4 pb-2 border-b border-stone-100">
          <div class="text-[9px] text-stone-500 font-mono font-black uppercase truncate mb-1">
            {{ rm.modelName.split('/').pop() }}
          </div>
          <div class="text-[9px] text-stone-400 font-mono flex gap-3 flex-wrap">
            <span>{{ rm.status.toUpperCase() }}</span>
            <span v-if="rm.latencyMs">// {{ rm.latencyMs }}ms</span>
            <template v-if="rm.usage">
              <span>// <span class="text-amber-600 font-bold">${{ (rm.usage.cost ?? rm.usage.estimated_cost ?? 0).toFixed(6) }}</span></span>
              <span>// {{ rm.usage.total_tokens }} tok</span>
            </template>
          </div>
        </div>

        <!-- Scrollable output -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-4" style="max-height: 520px;">
          <div v-for="out in rm.outputs" :key="out.id" class="text-sm text-stone-800 leading-relaxed font-sans">
            <MarkdownContent :content="out.outputText || ''" />
            <span v-if="rm.status === 'running'" class="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1 align-middle opacity-70"></span>
          </div>
          <div v-if="rm.errorMessage" class="text-xs text-red-700 font-bold bg-red-50 p-3 border border-red-200 mt-3">
            > ERR: {{ rm.errorMessage }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

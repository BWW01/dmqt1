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

    <div class="grid gap-4">
      <div v-for="rm in runData.runModels" :key="rm.id" class="border border-stone-300 bg-white p-4 relative overflow-hidden">
        <div v-if="rm.status === 'running'" class="absolute top-0 left-0 h-1 bg-green-600 animate-pulse w-full"></div>

        <div class="text-[9px] text-stone-500 font-mono flex gap-3">
          <span>{{ rm.status.toUpperCase() }}</span>
          <span>//</span>
          <span>{{ rm.latencyMs ? rm.latencyMs + 'ms' : '...' }}</span>

          <template v-if="rm.usage">
            <span>//</span>
            <span class="text-amber-600 font-bold">COST: ${{ (rm.usage.cost ?? rm.usage.estimated_cost ?? 0).toFixed(6) }}</span>
            <span>//</span>
            <span class="text-stone-400">TOKENS: {{ rm.usage.total_tokens }}</span>
          </template>
        </div>

        <div v-for="out in rm.outputs" :key="out.id" class="text-sm text-stone-800 leading-relaxed font-sans border-l-2 border-stone-200 pl-4 mt-2">
          <MarkdownContent :content="out.outputText || ''" />
          <span v-if="rm.status === 'running'" class="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1 align-middle opacity-70"></span>
        </div>

        <div v-if="rm.errorMessage" class="text-xs text-red-700 font-bold bg-red-50 p-3 border border-red-200 mt-3">
          > ERR: {{ rm.errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
// Assuming MarkdownContent is available
// import MarkdownContent from './MarkdownContent.vue';

const props = defineProps<{
  runModel: {
    id: number;
    modelName: string;
    status: string;
    latencyMs: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    outputs: { id: number; outputText: string }[];
  };
}>();

const statusStyles = computed(() => {
  switch (props.runModel.status) {
    case "succeeded":
      return "text-emerald-500 border-emerald-900 bg-emerald-950/20";
    case "failed":
      return "text-red-500 border-red-900 bg-red-950/20";
    case "running":
      return "text-amber-500 border-amber-900 bg-amber-950/20 animate-pulse";
    case "queued":
      return "text-zinc-500 border-zinc-800 bg-zinc-950";
    default:
      return "text-zinc-500 border-zinc-800 bg-zinc-950";
  }
});

const statusText = computed(() => {
  if (props.runModel.status === 'succeeded') return 'COMPLETED';
  if (props.runModel.status === 'running') return 'PROCESSING';
  if (props.runModel.status === 'failed') return 'ERROR';
  return props.runModel.status.toUpperCase();
});
</script>

<template>
  <div class="border-2 border-zinc-900 bg-black flex flex-col h-full overflow-hidden font-mono">

    <div class="px-4 py-2 border-b-2 flex items-center justify-between" :class="statusStyles.split(' ')[1] + ' ' + statusStyles.split(' ')[2]">
      <h4 class="font-bold text-xs uppercase tracking-widest text-zinc-300 truncate mr-4" :title="runModel.modelName">
        {{ runModel.modelName.split("/").pop() }}
      </h4>
      <div class="flex items-center gap-2">
        <span v-if="runModel.latencyMs" class="text-[10px] text-zinc-500 font-bold">
          {{ (runModel.latencyMs / 1000).toFixed(2) }}s
        </span>
        <span class="text-[10px] px-2 py-0.5 border font-black tracking-widest" :class="statusStyles">
          {{ statusText }}
        </span>
      </div>
    </div>

    <div class="p-4 flex-1 bg-zinc-950 overflow-y-auto custom-scrollbar">

      <div v-if="runModel.status === 'running' || runModel.status === 'queued'" class="flex items-center justify-center h-full text-zinc-600 gap-3">
        <div class="w-2 h-4 bg-amber-600 animate-bounce"></div>
        <span class="text-xs font-bold uppercase tracking-widest">Awaiting output...</span>
      </div>

      <div v-else-if="runModel.status === 'failed'" class="text-red-500 text-sm">
        <div class="font-black uppercase border-b border-red-900/50 pb-2 mb-2">
          > ERR_CODE: {{ runModel.errorCode || "UNKNOWN_FAILURE" }}
        </div>
        <div class="text-xs text-red-400 opacity-80 whitespace-pre-wrap">{{ runModel.errorMessage }}</div>
      </div>

      <div v-else-if="runModel.outputs?.[0]" class="text-zinc-300 text-sm leading-relaxed">
        <MarkdownContent :content="runModel.outputs[0].outputText" />
      </div>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #000;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #dc2626;
}
</style>
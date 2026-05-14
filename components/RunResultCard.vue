<script setup lang="ts">
import { computed } from 'vue';

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
      return "text-green-700 border-green-400 bg-green-50";
    case "failed":
      return "text-red-700 border-red-400 bg-red-50";
    case "running":
      return "text-amber-700 border-amber-400 bg-amber-50";
    case "queued":
      return "text-stone-600 border-stone-300 bg-stone-100";
    default:
      return "text-stone-600 border-stone-300 bg-stone-100";
  }
});
</script>

<template>
  <div
      class="border-2 border-stone-300 bg-stone-50 flex flex-col h-full overflow-hidden font-mono shadow-md relative"
  >
    <div
        class="px-3 py-2 border-b-2 flex items-center justify-between"
        :class="statusStyles"
    >
      <div class="flex items-center gap-2 overflow-hidden">
        <div
            v-if="runModel.status === 'running'"
            class="w-1.5 h-1.5 bg-amber-500 animate-ping shrink-0"
        ></div>
        <h4
            class="font-black text-[10px] uppercase tracking-tighter truncate text-stone-800"
        >
          ID: {{ runModel.modelName.split("/").pop() }}
        </h4>
      </div>
      <div class="flex items-center gap-3 shrink-0 ml-2">
        <span
            v-if="runModel.latencyMs"
            class="text-[9px] text-stone-500 font-bold tabular-nums"
        >
          {{ (runModel.latencyMs / 1000).toFixed(2) }}s
        </span>
        <span
            class="text-[9px] px-1.5 py-0.5 border font-black tracking-[0.1em]"
        >
          {{
            runModel.status === "succeeded"
                ? "READY"
                : runModel.status.toUpperCase()
          }}
        </span>
      </div>
    </div>

    <div
        class="p-4 flex-1 bg-white overflow-y-auto custom-scrollbar relative"
    >
      <div
          v-if="
          runModel.status === 'running' || runModel.status === 'queued'
        "
          class="flex flex-col items-center justify-center h-full text-stone-400 animate-pulse"
      >
        <div class="text-[10px] font-black uppercase tracking-[0.3em]">
          Downloading_Response
        </div>
        <div class="w-24 h-0.5 bg-stone-200 mt-2 relative">
          <div
              class="absolute inset-y-0 left-0 bg-green-600 w-1/2 animate-[progress_2s_infinite]"
          ></div>
        </div>
      </div>

      <div v-else-if="runModel.status === 'failed'" class="relative z-10">
        <div
            class="text-red-600 font-black text-xs uppercase mb-4 border-b border-red-300 pb-1"
        >
          > CRITICAL_FAILURE_DETECTED
        </div>
        <div class="bg-red-50 p-3 border border-red-200">
          <div class="text-[10px] text-red-500 font-bold mb-1 opacity-70">
            CODE: {{ runModel.errorCode || "UNSPECIFIED" }}
          </div>
          <div class="text-xs text-stone-600 italic leading-relaxed">
            {{ runModel.errorMessage }}
          </div>
        </div>
      </div>

      <div
          v-else-if="runModel.outputs?.[0]"
          class="text-stone-700 relative z-10"
      >
        <MarkdownContent :content="runModel.outputs[0].outputText" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes progress {
  0% {
    left: -20%;
    width: 20%;
  }
  100% {
    left: 100%;
    width: 20%;
  }
}
</style>
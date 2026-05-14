<script setup lang="ts">
const temperature = defineModel<number>("temperature", { required: true });
const topP = defineModel<number>("topP", { required: true });
const maxTokens = defineModel<number>("maxTokens", { required: true });
</script>

<template>
  <div class="space-y-4 font-mono">
    <div class="text-[10px] text-zinc-500 uppercase font-black tracking-widest border-b border-zinc-900 pb-1 mb-2">
      // Hyperparameters
    </div>

    <div>
      <label class="flex justify-between text-[10px] font-bold text-zinc-400 uppercase mb-2">
        <span>Temperature</span>
        <span class="text-red-500">{{ temperature.toFixed(2) }}</span>
      </label>
      <input
          v-model.number="temperature"
          type="range"
          min="0"
          max="2"
          step="0.05"
          class="w-full accent-red-600 cursor-pointer h-1 bg-zinc-800 appearance-none outline-none"
      />
    </div>

    <div>
      <label class="flex justify-between text-[10px] font-bold text-zinc-400 uppercase mb-2">
        <span>Top P</span>
        <span class="text-red-500">{{ topP.toFixed(2) }}</span>
      </label>
      <input
          v-model.number="topP"
          type="range"
          min="0"
          max="1"
          step="0.05"
          class="w-full accent-red-600 cursor-pointer h-1 bg-zinc-800 appearance-none outline-none"
      />
    </div>

    <div>
      <label class="flex justify-between text-[10px] font-bold text-zinc-400 uppercase mb-2">
        <span>Max_Tokens</span>
        <span class="text-red-500">{{ maxTokens }}</span>
      </label>
      <input
          v-model.number="maxTokens"
          type="number"
          min="1"
          max="16384"
          class="w-full bg-black border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs outline-none focus:border-red-600 transition-colors"
      />
    </div>
  </div>
</template>

<style scoped>
/* Basic styling for the range sliders to look sharp */
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 12px;
  width: 8px;
  background: #dc2626;
  cursor: pointer;
  border-radius: 0;
}
</style>
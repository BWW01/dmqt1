<script setup lang="ts">
const temperature = defineModel<number>("temperature", { required: true });
const topP = defineModel<number>("topP", { required: true });
const maxTokens = defineModel<number>("maxTokens", { required: true });
</script>

<template>
  <div class="space-y-6 font-mono p-1">
    <div
        class="text-[10px] text-stone-500 uppercase font-black tracking-[0.2em] border-b border-stone-300 pb-2 flex justify-between"
    >
      <span>// NEURAL_WEIGHTS</span>
      <span class="text-stone-400 italic">v1.0.4</span>
    </div>

    <div class="group">
      <label
          class="flex justify-between text-[10px] font-black text-stone-500 uppercase mb-3 tracking-widest group-hover:text-stone-800 transition-colors"
      >
        <span>Temperature</span>
        <span class="text-green-700 bg-green-50 px-1">{{
            temperature.toFixed(2)
          }}</span>
      </label>
      <input
          v-model.number="temperature"
          type="range"
          min="0"
          max="2"
          step="0.05"
          class="w-full"
      />
    </div>

    <div class="group">
      <label
          class="flex justify-between text-[10px] font-black text-stone-500 uppercase mb-3 tracking-widest group-hover:text-stone-800 transition-colors"
      >
        <span>Top_P_Density</span>
        <span class="text-green-700 bg-green-50 px-1">{{
            topP.toFixed(2)
          }}</span>
      </label>
      <input
          v-model.number="topP"
          type="range"
          min="0"
          max="1"
          step="0.05"
          class="w-full"
      />
    </div>

    <div>
      <label
          class="text-[10px] font-black text-stone-500 uppercase mb-2 block tracking-widest"
      >
        Max_Token_Limit
      </label>
      <div class="relative">
        <input
            v-model.number="maxTokens"
            type="number"
            min="1"
            max="16384"
            class="w-full bg-white border border-stone-300 text-green-700 px-3 py-2 text-xs outline-none focus:border-green-600 transition-colors font-bold"
        />
        <span
            class="absolute right-3 top-2 text-[9px] text-stone-400 font-bold uppercase"
        >UNIT_INT</span
        >
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ models: any[] }>();

const selectedModels = defineModel<string[]>("selectedModels", { required: true });
const systemPrompt = defineModel<string>("systemPrompt", { required: true });
const temperature = defineModel<number>("temperature", { required: true });
const topP = defineModel<number>("topP", { required: true });
const maxTokens = defineModel<number>("maxTokens", { required: true });
const includeLocation = defineModel<boolean>("includeLocation", { required: true });
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 pb-2">
    <div class="flex flex-col gap-6 p-4">
      <div>
        <h2 class="text-xs font-black text-stone-500 uppercase mb-4 tracking-widest border-l-2 border-green-600 pl-2">
          Execution_Params
        </h2>
        <ModelSelector :models="models" v-model="selectedModels" />
      </div>

      <div class="space-y-4 pt-4 border-t border-stone-200">
        <div>
          <label class="block text-[10px] text-stone-500 uppercase font-black mb-1">System_Override_Prompt</label>
          <textarea v-model="systemPrompt" class="w-full bg-stone-50 border border-stone-300 p-2 text-[11px] text-stone-600 focus:outline-none focus:border-green-600 min-h-[80px]" placeholder="OPTIONAL_SYSTEM_INSTRUCTION..."></textarea>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[9px] text-stone-500 uppercase font-black mb-1">Temp</label>
            <input type="number" step="0.1" v-model="temperature" class="w-full bg-stone-50 border border-stone-300 p-1 text-xs text-green-700" />
          </div>
          <div>
            <label class="block text-[9px] text-stone-500 uppercase font-black mb-1">Top_P</label>
            <input type="number" step="0.1" v-model="topP" class="w-full bg-stone-50 border border-stone-300 p-1 text-xs text-green-700" />
          </div>
          <div>
            <label class="block text-[9px] text-stone-500 uppercase font-black mb-1">Tokens</label>
            <input type="number" v-model="maxTokens" class="w-full bg-stone-50 border border-stone-300 p-1 text-xs text-green-700" />
          </div>
        </div>

        <div class="pt-2 border-t border-stone-200 mt-2">
          <label class="flex items-center gap-2 text-[9px] text-stone-500 uppercase font-black cursor-pointer">
            <input type="checkbox" v-model="includeLocation" class="accent-green-600 w-3 h-3 border-stone-300" />
            + Attach IP Location & Timestamp
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
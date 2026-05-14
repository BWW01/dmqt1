<script setup lang="ts">
defineProps<{ messages: any[] }>();
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-xs font-black text-stone-500 uppercase tracking-widest text-center italic">
      // Session_History_Dump
    </h3>
    <div class="space-y-4">
      <div v-for="msg in messages" :key="msg.id" :class="[
          'p-4 border flex flex-col',
          msg.sender === 'user' ? 'bg-stone-50 border-stone-300 ml-8' : 'bg-green-50 border-green-200 mr-8',
        ]">
        <div class="flex justify-between items-center mb-2 pb-2 border-b border-stone-200 border-opacity-50">
          <div class="text-[9px] font-black uppercase" :class="msg.sender === 'user' ? 'text-stone-500' : 'text-green-700'">
            {{ msg.sender === "user" ? "> OPERATOR_INPUT" : "> NEURAL_OUTPUT" }}
          </div>

          <div v-if="msg.metaJson" class="text-[8px] text-stone-400 font-mono text-right flex items-center justify-end gap-2 flex-wrap">
            <span v-if="msg.metaJson.timestamp">{{ new Date(msg.metaJson.timestamp).toLocaleString() }}</span>
            <span v-if="msg.metaJson.location" class="text-green-600 bg-green-100 px-1 rounded">{{ msg.metaJson.location }}</span>

            <template v-if="msg.metaJson.model">
              <span>//</span><span>{{ msg.metaJson.model }}</span>
            </template>
            <template v-if="msg.metaJson.latencyMs">
              <span>//</span><span>{{ msg.metaJson.latencyMs }}ms</span>
            </template>
            <template v-if="msg.metaJson.usage">
              <span>//</span>
              <span class="text-amber-600 font-bold">COST: ${{ (msg.metaJson.usage.cost ?? msg.metaJson.usage.estimated_cost ?? 0).toFixed(6) }}</span>
              <span v-if="msg.metaJson.usage.total_tokens">(TOKENS: {{ msg.metaJson.usage.total_tokens }})</span>
            </template>
          </div>
        </div>

        <div class="text-sm font-sans" :class="msg.sender === 'user' ? 'text-stone-700' : 'text-stone-800'">
          <MarkdownContent v-if="msg.sender !== 'user'" :content="msg.content" />
          <div v-else class="whitespace-pre-wrap">{{ msg.content }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
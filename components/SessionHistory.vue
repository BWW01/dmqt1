<script setup lang="ts">
defineProps<{ messages: any[] }>();
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-xs font-black text-zinc-600 uppercase tracking-widest text-center italic">
      // Session_History_Dump
    </h3>
    <TransitionGroup name="message" tag="div" class="space-y-4">
      <div
          v-for="msg in messages"
          :key="msg.id"
          :class="[
            'p-4 border flex flex-col',
            msg.sender === 'user'
              ? 'bg-zinc-900 border-zinc-700 ml-8'
              : 'bg-zinc-900 border-orange-900 border-l-2 border-l-orange-500 mr-8',
          ]"
      >
        <div class="flex justify-between items-center mb-2 pb-2 border-b border-zinc-800">
          <div
              class="text-[9px] font-black uppercase"
              :class="msg.sender === 'user' ? 'text-zinc-500' : 'text-orange-400'"
          >
            {{ msg.sender === "user" ? "> OPERATOR_INPUT" : "> NEURAL_OUTPUT" }}
          </div>

          <div v-if="msg.metaJson" class="text-[8px] text-zinc-600 font-mono text-right flex items-center justify-end gap-2 flex-wrap">
            <span v-if="msg.metaJson.timestamp">{{ new Date(msg.metaJson.timestamp).toLocaleString() }}</span>
            <span v-if="msg.metaJson.location" class="text-orange-400 bg-orange-950 px-1">{{ msg.metaJson.location }}</span>
            <template v-if="msg.metaJson.model">
              <span>//</span><span>{{ msg.metaJson.model }}</span>
            </template>
            <template v-if="msg.metaJson.latencyMs">
              <span>//</span><span>{{ msg.metaJson.latencyMs }}ms</span>
            </template>
            <template v-if="msg.metaJson.usage">
              <span>//</span>
              <span class="text-amber-500 font-bold">COST: ${{ (msg.metaJson.usage.cost ?? msg.metaJson.usage.estimated_cost ?? 0).toFixed(6) }}</span>
              <span v-if="msg.metaJson.usage.total_tokens" class="text-zinc-500">({{ msg.metaJson.usage.total_tokens }} tok)</span>
            </template>
          </div>
        </div>

        <div class="text-sm font-sans" :class="msg.sender === 'user' ? 'text-zinc-300' : 'text-zinc-100'">
          <MarkdownContent v-if="msg.sender !== 'user'" :content="msg.content" />
          <div v-else class="whitespace-pre-wrap">{{ msg.content }}</div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

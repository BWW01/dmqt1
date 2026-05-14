<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
// Assuming MarkdownContent.vue is globally registered or imported
// import MarkdownContent from './MarkdownContent.vue';

const props = defineProps<{
  messages: any[];
  conversationId: number | null;
}>();

const emit = defineEmits<{
  send: [];
}>();

const input = defineModel<string>("input", { required: true });

const messagesEnd = ref<HTMLElement>();

watch(
    () => props.messages.length,
    () => {
      nextTick(() => {
        messagesEnd.value?.scrollIntoView({ behavior: "smooth" });
      });
    },
);
</script>

<template>
  <div class="flex flex-col h-[70vh] bg-zinc-950 border-2 border-zinc-900 relative">

    <div v-if="!conversationId" class="flex-1 flex items-center justify-center text-zinc-600 uppercase text-sm font-bold tracking-widest bg-black">
      [ AWAITING_SEQUENCE_INITIALIZATION ]
    </div>

    <template v-else>
      <div class="flex-1 overflow-y-auto p-6 space-y-8 bg-black">
        <div v-for="msg in messages" :key="msg.id" class="w-full">
          <div class="text-[10px] mb-2 uppercase font-black tracking-widest flex items-center gap-2" :class="msg.sender === 'user' ? 'text-zinc-500' : 'text-red-600'">
            <span>{{ msg.sender === 'user' ? 'OPERATOR' : 'SYSTEM' }}</span>
            <div class="h-px flex-1" :class="msg.sender === 'user' ? 'bg-zinc-800' : 'bg-red-900/30'"></div>
          </div>

          <div :class="msg.sender === 'user' ? 'text-zinc-300' : 'text-white'">
            <MarkdownContent :content="msg.content" />

          </div>
        </div>
        <div ref="messagesEnd" />
      </div>

      <div class="p-4 bg-black border-t-2 border-zinc-900">
        <div class="flex gap-2">
          <input
              v-model="input"
              placeholder="Enter command parameters..."
              class="flex-1 bg-zinc-900 border border-zinc-800 text-red-500 font-mono text-sm px-4 py-3 focus:outline-none focus:border-red-600 placeholder-zinc-700 transition-colors"
              @keyup.enter="emit('send')"
          />
          <button
              class="btn-industrial w-32 flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!input.trim()"
              @click="emit('send')"
          >
            <span>EXECUTE</span>
            <span class="text-[9px] font-normal text-red-300 tracking-normal hidden sm:block">ENTER</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
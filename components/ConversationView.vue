<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

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
  <div
      class="flex flex-col h-[70vh] bg-white border-2 border-stone-300 relative shadow-sm"
  >
    <div
        v-if="!conversationId"
        class="flex-1 flex items-center justify-center text-stone-400 uppercase text-sm font-bold tracking-widest bg-stone-50"
    >
      [ AWAITING_SEQUENCE_INITIALIZATION ]
    </div>

    <template v-else>
      <div
          class="flex-1 overflow-y-auto p-6 space-y-8 bg-stone-50 custom-scrollbar"
      >
        <div v-for="msg in messages" :key="msg.id" class="w-full">
          <div
              class="text-[10px] mb-2 uppercase font-black tracking-widest flex items-center gap-2"
              :class="
              msg.sender === 'user' ? 'text-stone-400' : 'text-green-700'
            "
          >
            <span>{{ msg.sender === "user" ? "OPERATOR" : "SYSTEM" }}</span>
            <div
                class="h-px flex-1"
                :class="
                msg.sender === 'user' ? 'bg-stone-200' : 'bg-green-200'
              "
            ></div>
          </div>

          <div
              :class="
              msg.sender === 'user' ? 'text-stone-700' : 'text-stone-900'
            "
          >
            <MarkdownContent :content="msg.content" />
          </div>
        </div>
        <div ref="messagesEnd" />
      </div>

      <div class="p-4 bg-white border-t-2 border-stone-200">
        <div class="flex gap-2">
          <input
              v-model="input"
              placeholder="Enter command parameters..."
              class="flex-1 bg-stone-50 border border-stone-300 text-stone-800 font-mono text-sm px-4 py-3 focus:outline-none focus:border-green-600 placeholder-stone-400 transition-colors"
              @keyup.enter="emit('send')"
          />
          <button
              class="btn-industrial w-32 flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!input.trim()"
              @click="emit('send')"
          >
            <span>EXECUTE</span>
            <span
                class="text-[9px] font-normal text-green-600 tracking-normal hidden sm:block"
            >ENTER</span
            >
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
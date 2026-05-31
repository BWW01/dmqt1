<script setup lang="ts">
defineProps<{
  conversations: any[];
  selectedConversationId: number | null;
}>();

const emit = defineEmits<{
  select: [id: number];
  create: [];
}>();

const newConvTitle = defineModel<string>("newConvTitle", { required: true });
</script>

<template>
  <div class="flex flex-col h-full gap-6">
    <div class="flex flex-col flex-1 min-h-0">
      <h2 class="text-xs font-black text-zinc-500 uppercase mb-4 tracking-widest border-l-2 border-orange-500 pl-2">
        Sequences
      </h2>

      <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1">
        <button
            v-for="conv in conversations"
            :key="conv.id"
            @click="emit('select', conv.id)"
            :class="[
              'w-full text-left p-3 text-[11px] border transition-all duration-200 uppercase font-bold',
              selectedConversationId === conv.id
                ? 'border-orange-500 bg-orange-950 text-orange-400'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 bg-zinc-900',
            ]"
        >
          {{ conv.title || "NULL_SEQUENCE" }}
        </button>
      </div>
    </div>

    <div class="bg-zinc-900 border border-zinc-700 p-4 flex-none">
      <input
          v-model="newConvTitle"
          placeholder="NEW_SEQ_NAME..."
          class="w-full bg-zinc-950 border border-zinc-700 p-2 text-[10px] text-orange-400 mb-2 focus:outline-none focus:border-orange-500 placeholder-zinc-600"
      />
      <button @click="emit('create')" class="btn-industrial w-full text-[10px] py-2">
        INIT_NEW_SEQUENCE
      </button>
    </div>
  </div>
</template>

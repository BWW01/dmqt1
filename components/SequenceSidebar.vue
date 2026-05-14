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
      <h2 class="text-xs font-black text-stone-500 uppercase mb-4 tracking-widest border-l-2 border-green-600 pl-2">
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
              ? 'border-green-600 bg-green-50 text-green-700 shadow-sm'
              : 'border-stone-300 text-stone-500 hover:border-stone-400 bg-white',
          ]"
        >
          {{ conv.title || "NULL_SEQUENCE" }}
        </button>
      </div>
    </div>

    <div class="bg-white border border-stone-300 p-4 flex-none">
      <input v-model="newConvTitle" placeholder="NEW_SEQ_NAME..." class="w-full bg-stone-50 border border-stone-300 p-2 text-[10px] text-green-700 mb-2 focus:outline-none focus:border-green-600" />
      <button @click="emit('create')" class="btn-industrial w-full text-[10px] py-2">
        INIT_NEW_SEQUENCE
      </button>
    </div>
  </div>
</template>
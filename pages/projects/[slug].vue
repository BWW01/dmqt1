<script setup lang="ts">
// 1. JAVÍTÁS: Importáljuk a ref, watch és nextTick funkciókat is
import { computed, onMounted, watchEffect, ref, watch, nextTick } from 'vue';

import { useWorkspace } from '~/composables/useWorkspace';
import { useAIModels } from '~/composables/useAIModels';
import { useAttachments } from '~/composables/useAttachments';
import { useNeuralStream } from '~/composables/useNeuralStream';

const route = useRoute();
const projectSlug = computed(() => route.params.slug as string);

const { isLoggedIn } = useAuth();
watchEffect(() => { if (!isLoggedIn.value) navigateTo("/login"); });

// Composables behívása
const { project, conversations, selectedConversationId, messages, newConvTitle, loadProject, loadMessages, createConversation } = useWorkspace(projectSlug);
const { models, selectedModels, loadModels } = useAIModels();
const { uploadedImages, uploadLoading, handleFileUpload } = useAttachments();
const { mqInput, systemPrompt, temperature, topP, maxTokens, includeLocation, polling, runResult, streamingRun, startRun } = useNeuralStream(projectSlug, selectedConversationId, selectedModels, messages, uploadedImages, loadMessages);

// --- ÚJ GÖRGETÉSI LOGIKA KEZDŐDIK ---
const chatContainerRef = ref<HTMLElement | null>(null);

const scrollToBottom = async () => {
  await nextTick(); // Megvárjuk, amíg a Vue frissíti a DOM-ot (pl. megjelenik az új szöveg)
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
  }
};

// Figyeljük az üzeneteket és a futásokat. Ha változnak, azonnal lejjebb görgetünk.
watch(() => messages.value, scrollToBottom, { deep: true });
watch(() => streamingRun.value, scrollToBottom, { deep: true });
watch(() => runResult.value, scrollToBottom, { deep: true });
// --- ÚJ GÖRGETÉSI LOGIKA VÉGE ---

onMounted(async () => {
  await Promise.all([loadProject(), loadModels()]);
});

const removeImage = (index: number) => uploadedImages.value.splice(index, 1);
const handleConversationSelect = (id: number) => {
  selectedConversationId.value = id;
  loadMessages();
};
</script>
<template>
  <div class="p-6 font-mono h-full flex flex-col bg-stone-100 text-stone-800 overflow-hidden">
    <div v-if="project" class="max-w-[1600px] w-full mx-auto flex flex-col h-full min-h-0">

      <div class="flex-none flex justify-between items-center border-b-2 border-green-700 pb-4 mb-6">
        <div>
          <h1 class="text-3xl font-black text-green-700 uppercase tracking-tighter">
            // Workspace: {{ project.name }}
          </h1>
          <p class="text-[10px] text-stone-500 uppercase tracking-[0.3em]">
            Neural Interface v2.4 // {{ projectSlug }}
          </p>
        </div>
        <NuxtLink to="/" class="text-xs border border-stone-400 px-3 py-1 hover:bg-stone-200 transition-colors">
          [ EXIT_TO_DIRECTORY ]
        </NuxtLink>
      </div>

      <div class="grid grid-cols-12 gap-6 lg:gap-8 flex-1 min-h-0">

        <div class="col-span-12 lg:col-span-3 flex flex-col h-full min-h-0">
          <SequenceSidebar
              :conversations="conversations"
              :selectedConversationId="selectedConversationId"
              v-model:newConvTitle="newConvTitle"
              @select="handleConversationSelect"
              @create="createConversation"
          />
        </div>

        <div class="col-span-12 lg:col-span-6 flex flex-col h-full min-h-0 gap-4">

          <div ref="chatContainerRef" class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
            <SessionHistory
                v-if="selectedConversationId && messages.length > 0"
                :messages="messages"
            />
            <LiveExecutionResults
                v-if="streamingRun || runResult"
                :runData="streamingRun || runResult"
            />
          </div>

          <div class="flex-none">
            <NeuralInput
                v-model:mqInput="mqInput"
                :uploadLoading="uploadLoading"
                :polling="polling"
                :uploadedImages="uploadedImages"
                @upload="handleFileUpload"
                @execute="startRun"
                @removeImage="removeImage"
            />
          </div>
        </div>

        <div class="col-span-12 lg:col-span-3 flex flex-col h-full min-h-0">
          <NeuralParamsPanel
              :models="models"
              v-model:selectedModels="selectedModels"
              v-model:systemPrompt="systemPrompt"
              v-model:temperature="temperature"
              v-model:topP="topP"
              v-model:maxTokens="maxTokens"
              v-model:includeLocation="includeLocation"
          />
        </div>

      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center h-full gap-4">
      <div class="w-12 h-12 border-4 border-stone-300 border-t-green-600 animate-spin rounded-full"></div>
      <div class="text-stone-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">
        Synchronizing_Neural_Workspace...
      </div>
    </div>
  </div>
</template>
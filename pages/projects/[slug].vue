<script setup lang="ts">
import { ref, computed, onMounted, watchEffect } from 'vue';

const route = useRoute();
const { $api } = useApi();
const { isLoggedIn } = useAuth();

// --- State deklarációk ---
const project = ref<any>(null);
const conversations = ref<any[]>([]);
const selectedConversationId = ref<number | null>(null);
const messages = ref<any[]>([]);
const models = ref<any[]>([]);
const selectedModels = ref<string[]>([]);

const newConvTitle = ref("");
const mqInput = ref("");
const systemPrompt = ref("");

const temperature = ref(0.7);
const topP = ref(0.9);
const maxTokens = ref(2048);

const polling = ref(false);
const uploadLoading = ref(false); // Fájlfeltöltés állapota
const runResult = ref<any>(null);

// --- Auth check ---
watchEffect(() => {
  if (!isLoggedIn.value) navigateTo("/login");
});

const projectSlug = computed(() => route.params.slug as string);

// --- Adatkezelő függvények ---
async function loadProject() {
  try {
    project.value = await $api(`/api/projects/${projectSlug.value}`);
    conversations.value = project.value.conversations ?? [];
  } catch (e) {
    console.error("Failed to load project:", e);
  }
}

async function loadModels() {
  try {
    const data = await $api<any>("/api/models");
    models.value = data.data || data;
  } catch (e) {
    console.error("Failed to load models:", e);
  }
}

async function loadMessages() {
  if (!selectedConversationId.value) return;
  try {
    messages.value = await $api(`/api/conversations/${selectedConversationId.value}/messages`);
  } catch (e) {
    console.error("Failed to load messages:", e);
  }
}

// --- Fájlfeltöltés logika ---
const uploadedImages = ref<string[]>([]);

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;

  const formData = new FormData();
  formData.append('file', target.files[0]);

  uploadLoading.value = true;
  try {
    const response = await $api<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
    });

    // Itt a trükk: ha a response.url relatív, fűzzük hozzá a bázis URL-t
    // Példa: config.public.apiBase + response.url
    const fullUrl = response.url.startsWith('http')
        ? response.url
        : `http://localhost:3000${response.url}`; // Cseréld a saját szervered címére!

    uploadedImages.value.push(fullUrl);
  } catch (e) {
    alert("UPLOAD_FAILED");
  } finally {
    uploadLoading.value = false;
    target.value = '';
  }
}


async function createConversation() {
  const title = newConvTitle.value.trim() || `SEQ_${Math.floor(Math.random() * 10000)}`;
  try {
    const conv = await $api<any>(`/api/projects/${projectSlug.value}/conversations`, {
      method: "POST",
      body: { title },
    });
    newConvTitle.value = "";
    await loadProject();
    selectedConversationId.value = conv.id;
    await loadMessages();
  } catch (e) {
    alert("CONV_INIT_FAILED");
  }
}

async function startRun() {
  if (!selectedModels.value.length || (!mqInput.value.trim() && !uploadedImages.value.length)) return;

  polling.value = true;
  try {
    await $api("/api/runs", {
      method: "POST",
      body: {
        // ... többi paraméter
        userInput: mqInput.value,
        images: uploadedImages.value, // Külön mezőben küldjük a képeket
      },
    });
    // Siker esetén üríthetjük a listát
    uploadedImages.value = [];
    mqInput.value = "";
  } catch (e) {
    polling.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadProject(), loadModels()]);
});
</script>

<template>
  <div class="p-6 font-mono min-h-screen bg-black text-zinc-300">
    <div v-if="project" class="max-w-7xl mx-auto">

      <div class="flex justify-between items-center border-b-2 border-red-900 pb-4 mb-8">
        <div>
          <h1 class="text-3xl font-black text-red-600 uppercase tracking-tighter">
            // Workspace: {{ project.name }}
          </h1>
          <p class="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">Neural Interface v2.4 // {{ projectSlug }}</p>
        </div>
        <NuxtLink to="/" class="text-xs border border-zinc-800 px-3 py-1 hover:bg-zinc-900 transition-colors">
          [ EXIT_TO_DIRECTORY ]
        </NuxtLink>
      </div>

      <div class="grid grid-cols-12 gap-8">

        <div class="col-span-12 lg:col-span-3 space-y-6">
          <div>
            <h2 class="text-xs font-black text-zinc-500 uppercase mb-4 tracking-widest border-l-2 border-red-600 pl-2">Sequences</h2>
            <div class="space-y-1 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              <button
                  v-for="conv in conversations"
                  :key="conv.id"
                  @click="selectedConversationId = conv.id; loadMessages()"
                  :class="[
                  'w-full text-left p-3 text-[11px] border transition-all duration-200 uppercase font-bold',
                  selectedConversationId === conv.id
                    ? 'border-red-600 bg-red-950/10 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.1)]'
                    : 'border-zinc-900 text-zinc-600 hover:border-zinc-700'
                ]"
              >
                {{ conv.title || 'NULL_SEQUENCE' }}
              </button>
            </div>
          </div>

          <div class="bg-zinc-950 border border-zinc-900 p-4">
            <input
                v-model="newConvTitle"
                placeholder="NEW_SEQ_NAME..."
                class="w-full bg-black border border-zinc-800 p-2 text-[10px] text-red-500 mb-2 focus:outline-none focus:border-red-600"
            />
            <button @click="createConversation" class="btn-industrial w-full text-[10px] py-2">INIT_NEW_SEQUENCE</button>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-9 space-y-6">

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-zinc-950 border border-zinc-900 p-4">
            <div>
              <label class="block text-[10px] text-zinc-500 uppercase font-black mb-2">Neural_Model_Target</label>
              <select v-model="selectedModels" multiple class="w-full bg-black border border-zinc-800 text-red-500 p-2 text-[11px] min-h-[100px] focus:outline-none focus:border-red-600 custom-scrollbar">
                <option v-for="m in models" :key="m.id" :value="m.id">{{ m.id }}</option>
              </select>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] text-zinc-500 uppercase font-black mb-1">System_Override_Prompt</label>
                <input v-model="systemPrompt" class="w-full bg-black border border-zinc-800 p-2 text-[11px] text-zinc-400 focus:outline-none" placeholder="OPTIONAL_SYSTEM_INSTRUCTION..." />
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[9px] text-zinc-600 uppercase font-black">Temp</label>
                  <input type="number" step="0.1" v-model="temperature" class="w-full bg-black border border-zinc-800 p-1 text-xs text-red-500" />
                </div>
                <div>
                  <label class="block text-[9px] text-zinc-600 uppercase font-black">Top_P</label>
                  <input type="number" step="0.1" v-model="topP" class="w-full bg-black border border-zinc-800 p-1 text-xs text-red-500" />
                </div>
                <div>
                  <label class="block text-[9px] text-zinc-600 uppercase font-black">Tokens</label>
                  <input type="number" v-model="maxTokens" class="w-full bg-black border border-zinc-800 p-1 text-xs text-red-500" />
                </div>
              </div>
            </div>
          </div>

          <div class="relative group">
            <div class="absolute -top-2 left-4 bg-black px-2 text-[9px] text-red-600 font-black z-10">QUERY_INPUT_BUFFER</div>
            <textarea
                v-model="mqInput"
                placeholder="ENTER_NEURAL_QUERY_OR_INSTRUCTION..."
                class="w-full h-48 bg-black border-2 border-zinc-900 text-red-500 p-4 text-sm focus:border-red-600 outline-none transition-colors font-mono custom-scrollbar"
            ></textarea>

            <div class="flex justify-between items-center mt-2 bg-zinc-950 p-2 border border-zinc-900">
              <!-- Keresd meg a [ ATTACH_DATA_STREAM ] részt -->
              <label class="btn-industrial text-[10px] py-1 px-4 cursor-pointer flex items-center gap-2">
                <span v-if="uploadLoading" class="w-2 h-2 bg-red-600 animate-ping rounded-full"></span>
                {{ uploadLoading ? "UPLOADING_IMG..." : "[ ATTACH_IMAGE ]" }}
                <input
                    type="file"
                    class="hidden"
                    accept="image/*"
                    @change="handleFileUpload"
                    :disabled="uploadLoading"
                />
              </label>

              <!-- Képek előnézete a textarea és a gombok között (opcionális) --><div v-if="uploadedImages.length > 0" class="flex flex-wrap gap-3 p-3 bg-zinc-950 border-x border-zinc-900">
              <div
                  v-for="(url, index) in uploadedImages"
                  :key="index"
                  class="relative group w-24 h-24 border border-zinc-800 hover:border-red-600 transition-colors"
              >
                <img
                    :src="url"
                    class="w-full h-full object-cover grayscale group-hover:grayscale-0"
                    alt="Uploaded attachment"
                />
                <button
                    @click="uploadedImages.splice(index, 1)"
                    class="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 flex items-center justify-center hover:bg-red-500 font-black shadow-lg"
                >
                  X
                </button>
              </div>
            </div>

              <div class="flex justify-between items-center mt-2 bg-zinc-950 p-2 border border-zinc-900">
                <label class="btn-industrial text-[10px] py-1 px-4 cursor-pointer flex items-center gap-2">
                  <span v-if="uploadLoading" class="w-2 h-2 bg-red-600 animate-ping rounded-full"></span>
                  {{ uploadLoading ? "UPLOADING..." : "[ ATTACH_IMAGE ]" }}
                  <input type="file" class="hidden" accept="image/*" @change="handleFileUpload" />
                </label>

                <button @click="startRun" class="btn-industrial px-10 py-2">EXECUTE_RUN</button>
              </div>

              <button
                  @click="startRun"
                  :disabled="polling || !mqInput"
                  class="btn-industrial px-10 py-2 text-sm font-black disabled:opacity-30"
              >
                {{ polling ? "RUNNING_INFERENCE..." : "EXECUTE_RUN" }}
              </button>
            </div>
          </div>

          <div v-if="runResult" class="animate-in fade-in duration-500 space-y-4">
            <div class="flex items-center gap-2">
              <div class="h-[1px] flex-1 bg-zinc-900"></div>
              <span class="text-[10px] font-black text-zinc-600 uppercase">Latest_Execution_Results</span>
              <div class="h-[1px] flex-1 bg-zinc-900"></div>
            </div>

            <div class="grid gap-4">
              <div v-for="rm in runResult.runModels" :key="rm.id" class="border border-zinc-900 bg-zinc-950/50 p-4 relative overflow-hidden">
                <div v-if="rm.status === 'running'" class="absolute top-0 left-0 h-1 bg-red-600 animate-pulse w-full"></div>

                <div class="flex justify-between items-start mb-3">
                  <div>
                    <span class="text-[11px] font-black text-red-500 uppercase">{{ rm.modelName }}</span>
                    <div class="text-[9px] text-zinc-600 font-mono">{{ rm.status.toUpperCase() }} // {{ rm.latencyMs || '??' }}ms</div>
                  </div>
                </div>

                <div v-for="out in rm.outputs" :key="out.id" class="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans border-l border-zinc-800 pl-4">
                  {{ out.outputText }}
                </div>

                <div v-if="rm.errorMessage" class="text-xs text-red-900 font-bold bg-red-950/20 p-2 border border-red-900/50 mt-2">
                  > ERR: {{ rm.errorMessage }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedConversationId && messages.length > 0" class="mt-12 space-y-6">
            <h3 class="text-xs font-black text-zinc-600 uppercase tracking-widest text-center italic">// Session_History_Dump</h3>
            <div class="space-y-4">
              <div v-for="msg in messages" :key="msg.id" :class="['p-4 border', msg.sender === 'user' ? 'bg-zinc-900/30 border-zinc-800 ml-8' : 'bg-red-950/5 border-red-900/20 mr-8']">
                <div class="text-[9px] font-black uppercase mb-1" :class="msg.sender === 'user' ? 'text-zinc-500' : 'text-red-700'">
                  {{ msg.sender === 'user' ? '> OPERATOR_INPUT' : '> NEURAL_OUTPUT' }}
                </div>
                <div class="text-sm" :class="msg.sender === 'user' ? 'text-zinc-400' : 'text-zinc-200'">{{ msg.content }}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center h-[80vh] gap-4">
      <div class="w-12 h-12 border-4 border-red-900 border-t-red-600 animate-spin rounded-full"></div>
      <div class="text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Synchronizing_Neural_Workspace...</div>
    </div>
  </div>
</template>

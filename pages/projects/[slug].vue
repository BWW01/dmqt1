<script setup lang="ts">
import { ref, computed, onMounted, watchEffect } from 'vue';

const route = useRoute();
const { $api } = useApi();
const { isLoggedIn } = useAuth();
const token = useCookie("dmqt_token");
const project = ref<any>(null);
const conversations = ref<any[]>([]);
const selectedConversationId = ref<number | null>(null);
const messages = ref<any[]>([]);
const models = ref<any[]>([]);
const selectedModels = ref<string[]>([]);

const newConvTitle = ref("");
const mqInput = ref("");
const systemPrompt = ref("");

// Paraméterek
const temperature = ref(0.7);
const topP = ref(0.9);
const maxTokens = ref(2048);
const includeLocation = ref(false); // Új állapot a lokációhoz

const polling = ref(false);
const uploadLoading = ref(false);
const runResult = ref<any>(null);
const streamingRun = ref<any>(null); // Az élő adatfolyam állapota
const uploadedImages = ref<string[]>([]);

watchEffect(() => {
  if (!isLoggedIn.value) navigateTo("/login");
});

const projectSlug = computed(() => route.params.slug as string);

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
    messages.value = await $api(
        `/api/conversations/${selectedConversationId.value}/messages`,
    );
  } catch (e) {
    console.error("Failed to load messages:", e);
  }
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length) return;

  const formData = new FormData();
  formData.append("file", target.files[0]);

  uploadLoading.value = true;
  try {
    const response = await $api<{ url: string }>("/api/upload", {
      method: "POST",
      body: formData,
    });
    const fullUrl = response.url.startsWith("http")
        ? response.url
        : `http://localhost:3000${response.url}`;
    uploadedImages.value.push(fullUrl);
  } catch (e) {
    alert("UPLOAD_FAILED");
  } finally {
    uploadLoading.value = false;
    target.value = "";
  }
}

async function createConversation() {
  const title = newConvTitle.value.trim() || `SEQ_${Math.floor(Math.random() * 10000)}`;
  try {
    const conv = await $api<any>(
        `/api/projects/${projectSlug.value}/conversations`,
        { method: "POST", body: { title } },
    );
    newConvTitle.value = "";
    await loadProject();
    selectedConversationId.value = conv.id;
    await loadMessages();
  } catch (e) {
    alert("CONV_INIT_FAILED");
  }
}

async function startRun() {
  if (
      !selectedModels.value.length ||
      (!mqInput.value.trim() && !uploadedImages.value.length)
  ) return;

  // Ha nincs kiválasztva beszélgetés, jelezzük a usernek (opcionális, de ajánlott)
  if (!selectedConversationId.value) {
    alert("Kérlek előbb válassz ki, vagy indíts egy új Sequence-t (bal oldalt) a mentéshez!");
    return;
  }

  polling.value = true;
  runResult.value = null;
  streamingRun.value = null;

  // --- OPTIMISTA UI FRISSÍTÉS ---
  // Azonnal mutatjuk a felületen, amit a felhasználó beírt, az idővel együtt
  const tempMessage = {
    id: `temp_${Date.now()}`,
    sender: "user",
    content: mqInput.value,
    metaJson: {
      timestamp: new Date().toISOString(),
      location: includeLocation.value ? "Lekérdezés alatt..." : undefined,
      systemPrompt: systemPrompt.value
    }
  };
  messages.value.push(tempMessage); // Hozzáadjuk a listához helyben

  try {
    const bodyPayload = {
      userInput: mqInput.value,
      images: uploadedImages.value,
      models: selectedModels.value,
      projectSlug: projectSlug.value,
      conversationId: selectedConversationId.value,
      systemPrompt: systemPrompt.value,
      includeLocation: includeLocation.value,
      params: {
        temperature: temperature.value,
        top_p: topP.value,
        max_tokens: maxTokens.value
      }
    };

    uploadedImages.value = [];
    mqInput.value = "";

    const response = await fetch("/api/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${useCookie("dmqt_token").value}`
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.body) throw new Error("Nem érkezett adatfolyam");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      const lines = chunkText.split("\n").filter(line => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "init") {
              streamingRun.value = await $api(`/api/runs/${data.runId}`);
              streamingRun.value.runModels.forEach((rm: any) => {
                if (!rm.outputs || rm.outputs.length === 0) {
                  rm.outputs = [{ id: `temp_${rm.id}`, outputText: '' }];
                }
              });
            } else if (data.type === "chunk" && streamingRun.value) {
              const rm = streamingRun.value.runModels.find((m: any) => m.id === data.modelId);
              if (rm && rm.outputs && rm.outputs.length > 0) {
                rm.outputs[0].outputText += data.text;
              }
            } else if (data.type === "done" && streamingRun.value) {
              const rm = streamingRun.value.runModels.find((m: any) => m.id === data.modelId);
              if (rm) {
                rm.status = 'succeeded';
                // Elmentjük a usage adatot a modell futtatásához
                if (data.usage) {
                  rm.usage = data.usage;
                }
              }
            } else if (data.type === "error" && streamingRun.value) {
              const rm = streamingRun.value.runModels.find((m: any) => m.id === data.modelId);
              if (rm) {
                rm.status = 'failed';
                rm.errorMessage = data.error;
              }
            }
          } catch (e) {}
        }
      }
    }

    polling.value = false;
    runResult.value = streamingRun.value;
    streamingRun.value = null;

    // A stream végén újratöltjük az adatbázisból a VÉGLEGES üzeneteket,
    // hogy a "Lekérdezés alatt..." helyére bekerüljön a valódi város és a mentett AI válasz
    if (selectedConversationId.value) {
      await loadMessages();
    }

  } catch (e) {
    console.error("Futás hiba:", e);
    polling.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadProject(), loadModels()]);
});
</script>

<template>
  <div class="p-6 font-mono min-h-screen bg-stone-100 text-stone-800">
    <div v-if="project" class="max-w-7xl mx-auto">
      <div class="flex justify-between items-center border-b-2 border-green-700 pb-4 mb-8">
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

      <div class="grid grid-cols-12 gap-8">
        <div class="col-span-12 lg:col-span-3 space-y-6">
          <div>
            <h2 class="text-xs font-black text-stone-500 uppercase mb-4 tracking-widest border-l-2 border-green-600 pl-2">
              Sequences
            </h2>
            <div class="space-y-1 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              <button
                  v-for="conv in conversations"
                  :key="conv.id"
                  @click="selectedConversationId = conv.id; loadMessages();"
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

          <div class="bg-white border border-stone-300 p-4">
            <input v-model="newConvTitle" placeholder="NEW_SEQ_NAME..." class="w-full bg-stone-50 border border-stone-300 p-2 text-[10px] text-green-700 mb-2 focus:outline-none focus:border-green-600" />
            <button @click="createConversation" class="btn-industrial w-full text-[10px] py-2">
              INIT_NEW_SEQUENCE
            </button>
          </div>
        </div>

        <div class="col-span-12 lg:col-span-9 space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-white border border-stone-300 p-4">
            <div>
              <ModelSelector :models="models" v-model="selectedModels" />
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-[10px] text-stone-500 uppercase font-black mb-1">System_Override_Prompt</label>
                <input v-model="systemPrompt" class="w-full bg-stone-50 border border-stone-300 p-2 text-[11px] text-stone-600 focus:outline-none focus:border-green-600" placeholder="OPTIONAL_SYSTEM_INSTRUCTION..." />
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-[9px] text-stone-500 uppercase font-black">Temp</label>
                  <input type="number" step="0.1" v-model="temperature" class="w-full bg-stone-50 border border-stone-300 p-1 text-xs text-green-700" />
                </div>
                <div>
                  <label class="block text-[9px] text-stone-500 uppercase font-black">Top_P</label>
                  <input type="number" step="0.1" v-model="topP" class="w-full bg-stone-50 border border-stone-300 p-1 text-xs text-green-700" />
                </div>
                <div>
                  <label class="block text-[9px] text-stone-500 uppercase font-black">Tokens</label>
                  <input type="number" v-model="maxTokens" class="w-full bg-stone-50 border border-stone-300 p-1 text-xs text-green-700" />
                </div>
              </div>
              <div class="pt-2 border-t border-stone-200">
                <label class="flex items-center gap-2 text-[9px] text-stone-500 uppercase font-black cursor-pointer">
                  <input type="checkbox" v-model="includeLocation" class="accent-green-600 w-3 h-3 border-stone-300" />
                  + Attach IP Location & Timestamp
                </label>
              </div>
            </div>
          </div>

          <div class="relative group">
            <div class="absolute -top-2 left-4 bg-stone-100 px-2 text-[9px] text-green-700 font-black z-10">
              QUERY_INPUT_BUFFER
            </div>
            <textarea v-model="mqInput" placeholder="ENTER_NEURAL_QUERY_OR_INSTRUCTION..." class="w-full h-48 bg-white border-2 border-stone-300 text-stone-800 p-4 text-sm focus:border-green-600 outline-none transition-colors font-mono custom-scrollbar"></textarea>

            <div v-if="uploadedImages.length > 0" class="flex flex-wrap gap-3 p-3 bg-stone-50 border-x border-stone-300">
              <div v-for="(url, index) in uploadedImages" :key="index" class="relative group w-24 h-24 border border-stone-300 hover:border-green-600 transition-colors">
                <img :src="url" class="w-full h-full object-cover" alt="Uploaded attachment" />
                <button @click="uploadedImages.splice(index, 1)" class="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center hover:bg-red-600 font-black shadow-lg">X</button>
              </div>
            </div>

            <div class="flex justify-between items-center mt-0 bg-stone-50 p-2 border border-stone-300">
              <label class="btn-industrial text-[10px] py-1 px-4 cursor-pointer flex items-center gap-2">
                <span v-if="uploadLoading" class="w-2 h-2 bg-green-600 animate-ping rounded-full"></span>
                {{ uploadLoading ? "UPLOADING_IMG..." : "[ ATTACH_IMAGE ]" }}
                <input type="file" class="hidden" accept="image/*" @change="handleFileUpload" :disabled="uploadLoading" />
              </label>
              <button @click="startRun" :disabled="polling || (!mqInput && uploadedImages.length === 0)" class="btn-industrial px-10 py-2 text-sm font-black disabled:opacity-30 flex items-center gap-2">
                <span v-if="polling" class="w-2 h-2 bg-green-300 animate-pulse rounded-full"></span>
                {{ polling ? "STREAMING_DATA..." : "EXECUTE_RUN" }}
              </button>
            </div>
          </div>

          <div v-if="streamingRun || runResult" class="animate-in fade-in duration-500 space-y-4">
            <div class="flex items-center gap-2">
              <div class="h-[1px] flex-1 bg-stone-300"></div>
              <span class="text-[10px] font-black text-stone-500 uppercase">Latest_Execution_Results</span>
              <div class="h-[1px] flex-1 bg-stone-300"></div>
            </div>

            <div class="grid gap-4">
              <div v-for="rm in (streamingRun || runResult).runModels" :key="rm.id" class="border border-stone-300 bg-white p-4 relative overflow-hidden">
                <div v-if="rm.status === 'running'" class="absolute top-0 left-0 h-1 bg-green-600 animate-pulse w-full"></div>

                <div class="text-[9px] text-stone-500 font-mono flex gap-3">
                  <span>{{ rm.status.toUpperCase() }}</span>
                  <span>//</span>
                  <span>{{ rm.latencyMs ? rm.latencyMs + 'ms' : '...' }}</span>

                  <template v-if="rm.usage">
                    <span>//</span>
                    <span class="text-amber-600 font-bold">
      COST: ${{ rm.usage.cost?.toFixed(6) || '0.000000' }}
    </span>
                    <span>//</span>
                    <span class="text-stone-400">
      TOKENS: {{ rm.usage.total_tokens }}
    </span>
                  </template>
                </div>

                <div v-for="out in rm.outputs" :key="out.id" class="text-sm text-stone-800 leading-relaxed font-sans border-l-2 border-stone-200 pl-4">
                  <MarkdownContent :content="out.outputText || ''" />
                  <span v-if="rm.status === 'running'" class="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1 align-middle opacity-70"></span>
                </div>

                <div v-if="rm.errorMessage" class="text-xs text-red-700 font-bold bg-red-50 p-3 border border-red-200 mt-3">
                  > ERR: {{ rm.errorMessage }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedConversationId && messages.length > 0" class="mt-12 space-y-6">
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

                  <div v-if="msg.metaJson" class="text-[8px] text-stone-400 font-mono text-right">
                    <span v-if="msg.metaJson.timestamp" class="mr-2">{{ new Date(msg.metaJson.timestamp).toLocaleString() }}</span>
                    <span v-if="msg.metaJson.location" class="text-green-600 bg-green-100 px-1 rounded">{{ msg.metaJson.location }}</span>
                  </div>
                </div>

                <div class="text-sm font-sans" :class="msg.sender === 'user' ? 'text-stone-700' : 'text-stone-800'">
                  <MarkdownContent v-if="msg.sender !== 'user'" :content="msg.content" />
                  <div v-else class="whitespace-pre-wrap">{{ msg.content }}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center h-[80vh] gap-4">
      <div class="w-12 h-12 border-4 border-stone-300 border-t-green-600 animate-spin rounded-full"></div>
      <div class="text-stone-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">
        Synchronizing_Neural_Workspace...
      </div>
    </div>
  </div>
</template>
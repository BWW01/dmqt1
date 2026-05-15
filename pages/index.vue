<script setup lang="ts">
import { ref, onMounted } from 'vue';

const router = useRouter();
const { isLoggedIn } = useAuth();
const { $api } = useApi();

const projects = ref<any[]>([]);
const newProjectName = ref("");
const loading = ref(false);

definePageMeta({
  middleware: ["auth"]
});

async function loadProjects() {
  try {
    const data = await $api<any[]>("/api/projects");
    projects.value = data || [];
  } catch (e: any) {
    console.error("Failed to load projects:", e);
    if (e.status === 401) navigateTo("/login");
  }
}

async function createProject() {
  if (!newProjectName.value.trim()) {
    alert("ERR: Missing project identifier!");
    return;
  }
  loading.value = true;
  try {
    await $api("/api/projects", {
      method: "POST",
      body: { name: newProjectName.value.trim() },
    });
    newProjectName.value = "";
    await loadProjects();
  } catch (e) {
    alert("INIT_FAILED: " + (e as any).message);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) {
    await router.push("/login");
    return;
  }
  await loadProjects();
});
</script>

<template>
  <div class="max-w-7xl mx-auto font-mono">
    <div class="border-b-2 border-stone-300 pb-4 mb-8">
      <h1
          class="text-3xl font-black text-green-700 uppercase tracking-tighter"
      >
        // Project_Directory
      </h1>
      <p class="text-xs text-stone-500 uppercase tracking-widest mt-1">
        Select or initialize a neural workspace
      </p>
    </div>

    <div
        class="flex gap-2 mb-10 p-4 bg-white border border-stone-300 shadow-sm"
    >
      <input
          v-model="newProjectName"
          placeholder="ENTER_NEW_WORKSPACE_ID..."
          class="bg-stone-50 border border-stone-300 text-green-700 px-4 py-3 flex-1 focus:outline-none focus:border-green-600 transition-colors uppercase placeholder-stone-400 text-sm"
          @keyup.enter="createProject"
      />
      <button
          :disabled="loading"
          class="btn-industrial w-48 flex items-center justify-center disabled:opacity-50 disabled:grayscale"
          @click="createProject"
      >
        {{ loading ? "INITIALIZING..." : "INIT_WORKSPACE" }}
      </button>
    </div>

    <div
        v-if="!projects || projects.length === 0"
        class="text-stone-400 text-center py-20 uppercase font-black tracking-widest border-2 border-dashed border-stone-300"
    >
      [ NO_ACTIVE_WORKSPACES_FOUND ]
    </div>

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
          v-for="p in projects"
          :key="p.slug"
          :to="`/projects/${p.slug}`"
          class="block bg-white border-2 border-stone-300 p-6 hover:border-green-600 transition-colors relative group shadow-sm"
      >
        <div
            class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-stone-300 group-hover:border-green-500 transition-colors"
        ></div>

        <h2
            class="font-black text-xl text-stone-800 uppercase tracking-tight group-hover:text-green-700 transition-colors"
        >
          {{ p.name }}
        </h2>

        <div
            class="text-xs text-stone-500 mt-4 uppercase font-bold tracking-widest space-y-1"
        >
          <div class="flex justify-between">
            <span>Sequences:</span>
            <span class="text-green-700">{{
                p._count?.conversations ?? 0
              }}</span>
          </div>
          <div class="flex justify-between">
            <span>Executions:</span>
            <span class="text-green-700">{{ p._count?.runs ?? 0 }}</span>
          </div>
        </div>

        <div
            class="text-[10px] text-stone-400 mt-6 pt-4 border-t border-stone-200"
        >
          CREATED:
          {{ new Date(p.createdAt).toISOString().split("T")[0] }}
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
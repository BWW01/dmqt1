<script setup lang="ts">
const { logout, user } = useAuth();
</script>

<template>
  <div class="min-h-screen bg-black text-zinc-300 font-mono flex flex-col">
    <header class="border-b-2 border-red-900 bg-zinc-950 p-4 flex items-center justify-between">
      <div class="text-red-600 font-black uppercase tracking-widest text-xl">
        DM-QT <span class="text-zinc-600 text-xs ml-2">// TERMINAL_ACTIVE</span>
      </div>

      <div v-if="user" class="flex items-center gap-6 text-xs uppercase font-bold">
        <span class="text-zinc-500">OP: {{ user.email }}</span>
        <NuxtLink to="/" class="text-zinc-400 hover:text-red-500 transition-colors">
          [ Projects ]
        </NuxtLink>
        <button @click="logout" class="text-red-900 hover:text-red-500 transition-colors">
          [ Terminate_Link ]
        </button>
      </div>
    </header>

    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
</template>
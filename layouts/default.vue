<script setup lang="ts">
const { logout, user } = useAuth();
</script>

<template>
  <div class="h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col overflow-hidden">
    <header class="flex-none border-b-2 border-zinc-800 bg-zinc-950 p-4 flex items-center justify-between z-10">
      <div class="text-zinc-50 font-black uppercase tracking-widest text-xl">
        DM-QT <span class="text-zinc-600 text-xs ml-2">// TERMINAL_ACTIVE</span>
      </div>

      <div v-if="user" class="flex items-center gap-6 text-xs uppercase font-bold">
        <span class="text-zinc-400">OP: {{ user.email }}</span>

        <span class="text-orange-400 bg-orange-950 border border-orange-800 px-2 py-1">
          CREDITS: ${{ (user.credits / 1_000_000).toFixed(4) }}
        </span>

        <NuxtLink to="/" class="text-zinc-500 hover:text-zinc-50 transition-colors">
          [ Projects ]
        </NuxtLink>
        <button @click="logout" class="text-red-500 hover:text-red-400 transition-colors">
          [ Terminate_Link ]
        </button>
      </div>
    </header>

    <main class="flex-1 min-h-0 flex flex-col">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { logout, user } = useAuth();
</script>

<template>
  <div class="h-screen bg-stone-50 text-stone-900 font-mono flex flex-col overflow-hidden">
    <header class="flex-none border-b-2 border-stone-300 bg-white p-4 flex items-center justify-between z-10">
      <div class="text-stone-900 font-black uppercase tracking-widest text-xl">
        DM-QT <span class="text-stone-400 text-xs ml-2">// TERMINAL_ACTIVE</span>
      </div>

      <div v-if="user" class="flex items-center gap-6 text-xs uppercase font-bold">
        <span class="text-stone-500">OP: {{ user.email }}</span>
        <NuxtLink to="/" class="text-stone-400 hover:text-stone-900 transition-colors">
          [ Projects ]
        </NuxtLink>
        <button @click="logout" class="text-red-600 hover:text-red-400 transition-colors">
          [ Terminate_Link ]
        </button>
      </div>
    </header>

    <main class="flex-1 min-h-0 flex flex-col">
      <slot />
    </main>
  </div>
</template>
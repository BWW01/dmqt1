<script setup lang="ts">
const { logout, user } = useAuth();
</script>

<template>
  <!-- bg-black-ről bg-stone-50-re váltva -->
  <div class="min-h-screen bg-stone-50 text-stone-900 font-mono flex flex-col">
    <!-- border-red-900-ról border-stone-300-ra, bg-zinc-950-ről bg-white-re váltva -->
    <header class="border-b-2 border-stone-300 bg-white p-4 flex items-center justify-between">
      <!-- text-red-600-ról text-stone-900-ra váltva -->
      <div class="text-stone-900 font-black uppercase tracking-widest text-xl">
        DM-QT <span class="text-stone-400 text-xs ml-2">// TERMINAL_ACTIVE</span>
      </div>

      <div v-if="user" class="flex items-center gap-6 text-xs uppercase font-bold">
        <!-- text-zinc-500 helyett text-stone-500 -->
        <span class="text-stone-500">OP: {{ user.email }}</span>
        <!-- text-zinc-400 helyett text-stone-400 -->
        <NuxtLink to="/" class="text-stone-400 hover:text-stone-900 transition-colors">
          [ Projects ]
        </NuxtLink>
        <!-- text-red-900 helyett text-red-600 (vagy stone-600 a még tisztább képért) -->
        <button @click="logout" class="text-red-600 hover:text-red-400 transition-colors">
          [ Terminate_Link ]
        </button>
      </div>
    </header>

    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
</template>
<script setup lang="ts">
const { login, register, isLoggedIn } = useAuth();

const email = ref("");
const password = ref("");
const error = ref("");
const isRegister = ref(false);
const loading = ref(false);

async function handleSubmit() {
  error.value = "";
  loading.value = true;
  try {
    if (isRegister.value) {
      await register(email.value, password.value);
    } else {
      await login(email.value, password.value);
    }
    navigateTo("/");
  } catch (e: any) {
    error.value = e.data?.message || e.message || "SYSTEM_ERROR";
  } finally {
    loading.value = false;
  }
}

if (process.client) {
  watchEffect(() => {
    if (isLoggedIn.value) navigateTo("/");
  });
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[85vh] font-mono">
    <div
        class="w-full max-w-md bg-white border-2 border-green-600 p-8 relative shadow-lg"
    >
      <div class="absolute top-0 left-0 w-full h-1 bg-green-600"></div>
      <div
          class="absolute -top-3 left-4 bg-stone-100 px-2 text-[10px] text-green-700 font-black uppercase tracking-[0.2em]"
      >
        SECURITY_GATEWAY_V1.0
      </div>

      <h1
          class="text-2xl font-black mb-2 text-center text-stone-800 uppercase tracking-tighter"
      >
        {{ isRegister ? "Operator_Registration" : "System_Login" }}
      </h1>
      <p
          class="text-center text-[10px] text-stone-500 uppercase tracking-widest mb-8"
      >
        Please authenticate to continue
      </p>

      <div
          v-if="error"
          class="bg-red-50 border border-red-400 text-red-600 p-3 mb-6 text-xs uppercase font-bold tracking-widest"
      >
        > ERR: {{ error }}
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div>
          <label
              class="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1"
          >
            Operator_ID (Email)
          </label>
          <input
              v-model="email"
              type="email"
              required
              class="w-full bg-stone-50 border border-stone-300 text-stone-800 px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-colors"
          />
        </div>

        <div>
          <label
              class="block text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1"
          >
            Access_Code (Password)
          </label>
          <input
              v-model="password"
              type="password"
              required
              minlength="6"
              class="w-full bg-stone-50 border border-stone-300 text-stone-800 px-4 py-3 text-sm focus:outline-none focus:border-green-600 transition-colors font-sans"
          />
        </div>

        <button
            type="submit"
            :disabled="loading"
            class="btn-industrial w-full mt-4 flex items-center justify-center gap-2"
        >
          <span
              v-if="loading"
              class="w-3 h-3 bg-green-600 animate-ping rounded-full"
          ></span>
          {{
            loading
                ? "AUTHENTICATING..."
                : isRegister
                    ? "REGISTER_OPERATOR"
                    : "AUTHORIZE_ACCESS"
          }}
        </button>
      </form>

      <div class="text-center mt-8 pt-6 border-t border-stone-200">
        <button
            class="text-[10px] text-stone-400 hover:text-green-600 uppercase font-black tracking-widest transition-colors"
            @click="isRegister = !isRegister"
        >
          {{
            isRegister
                ? "[ Switch to Authorization ]"
                : "[ Request Operator Status ]"
          }}
        </button>
      </div>
    </div>
  </div>
</template>
// nuxt.config.ts
export default defineNuxtConfig({
    compatibilityDate: "2025-01-01",
    modules: ["@nuxtjs/tailwindcss"],

    css: ['~/assets/css/main.css'],
    postcss: {
        plugins: {
            tailwindcss: {},
            autoprefixer: {},
        },
    },
    runtimeConfig: {
        jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
        deepinfraApiKey: process.env.DEEPINFRA_API_KEY || "",
        databaseUrl: process.env.DATABASE_URL || "",
    },
    nitro: {
        preset: "node-server",
    },
});
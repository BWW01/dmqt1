// nuxt.config.ts
export default defineNuxtConfig({
    compatibilityDate: "2025-01-01",
    modules: ["@nuxtjs/tailwindcss", "@nuxtjs/i18n"],
    css: ['~/assets/css/main.css'],

    vite: {
        server: {
            watch: {
                usePolling: true,
                interval: 100,
            },
        },
    },

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
        githubToken: process.env.GITHUB_TOKEN,
    },
    nitro: {
        preset: "node-server",
    },
    i18n: {
        locales: [
            { code: 'en', file: 'en.json' }
        ],
        defaultLocale: 'en',
        lazy: true,
        langDir: 'locales/', // Ide tesszük a szótárakat
        strategy: 'no_prefix' // Nem tesz /en/-t az URL-be
    },
});
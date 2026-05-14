// tailwind.config.ts
import type { Config } from "tailwindcss";
import typography from '@tailwindcss/typography';

export default {
    content: [
        "./components/**/*.{vue,ts}",
        "./layouts/**/*.vue",
        "./pages/**/*.vue",
        "./app.vue",
    ],
    theme: {
        extend: {},
    },
    plugins: [typography],
} satisfies Config;
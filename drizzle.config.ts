// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './server/database/schema.ts', // Adjust this path if your schema is elsewhere
    out: './server/database/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
import { drizzle } from 'drizzle-orm/postgres-js' // or your driver
import postgres from 'postgres'

const queryClient = postgres(process.env.DATABASE_URL)
export const db = drizzle(queryClient)
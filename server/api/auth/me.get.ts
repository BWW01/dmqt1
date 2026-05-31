// server/api/auth/me.get.ts
import { db } from "~~/server/utils/db";
import { eq } from "drizzle-orm";
import { users } from "~~/server/database/schema";


export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    const [user] = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            credits: users.credits,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw createError({ statusCode: 404, message: "User not found" });
    }

    return { user };
});
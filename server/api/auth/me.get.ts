// server/api/auth/me.get.ts
import { db } from "~~/server/utils/db"; // Changed to named import 'db'
import { eq } from "drizzle-orm";
import { users } from "~~/server/database/schema"; // Update path if needed

import { verifyPassword, signToken } from "~~/server/utils/auth";
import { chatCompletion, listModels } from "~~/server/utils/deepinfra";

export default defineEventHandler(async (event) => {
    // Assuming you have middleware or logic to get the user ID from the token
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({
            statusCode: 401,
            message: "Unauthorized",
        });
    }

    // --- Drizzle implementation replacing Prisma ---
    const [user] = await db
        .select({
            id: users.id,
            email: users.email,
            role: users.role,
            // Only select the safe fields you want to return
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw createError({
            statusCode: 404,
            message: "User not found",
        });
    }

    return { user };
});
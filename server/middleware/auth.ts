// server/middleware/auth.ts
import { verifyToken } from "~/server/utils/auth"

export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;

    // Publikus útvonalak
    if (
        path === "/api/auth/login" ||
        path === "/api/auth/register" ||
        path.startsWith("/api/uploads/") ||
        !path.startsWith("/api/")
    ) {
        return;
    }

    const header = getRequestHeader(event, "authorization");
    if (!header?.startsWith("Bearer ")) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }

    try {
        const payload = verifyToken(header.slice(7));
        event.context.user = { id: Number(payload.sub) };

    } catch {
        throw createError({
            statusCode: 401,
            message: "Invalid or expired token",
        });
    }
});
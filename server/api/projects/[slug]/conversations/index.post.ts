// server/api/projects/[slug]/conversations/index.post.ts
import { db } from "~~/server/utils/db";
import { eq, and } from "drizzle-orm";
import { projects, conversations } from "~~/server/database/schema";

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }
    const slug = getRouterParam(event, "slug");
    const { title } = await readBody(event);

    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.slug, slug), eq(projects.userId, userId)))
        .limit(1);

    if (!project) {
        throw createError({ statusCode: 404, message: "Project not found" });
    }

    const [conversation] = await db
        .insert(conversations)
        .values({
            projectId: project.id,
            title: title || null,
        })
        .returning();

    return conversation;
});
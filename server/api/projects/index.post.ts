// server/api/projects/index.post.ts
import { db } from "~~/server/utils/db";
import { projects } from "~~/server/database/schema";

// Helper function to generate a URL-safe, unique slug from the project name
const generateSlug = (name: string) => {
    const baseSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // Append a short random alphanumeric string to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${randomSuffix}`;
};

export default defineEventHandler(async (event) => {
    const userId = event.context.user?.id;

    if (!userId) {
        throw createError({ statusCode: 401, message: "Unauthorized" });
    }
    const { name } = await readBody(event);

    if (!name) {
        throw createError({
            statusCode: 400,
            message: "Project name required",
        });
    }

    // Generate the slug explicitly before insertion
    const slug = generateSlug(name);

    const [project] = await db
        .insert(projects)
        .values({
            name,
            userId,
            slug // Pass the generated slug to satisfy the NOT NULL constraint
        })
        .returning({
            id: projects.id,
            slug: projects.slug,
            name: projects.name,
            createdAt: projects.createdAt,
        });

    return project;
});
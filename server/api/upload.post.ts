import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export default defineEventHandler(async (event) => {
    const formData = await readMultipartFormData(event);
    if (!formData) throw createError({ statusCode: 400, message: "No file uploaded" });

    const file = formData.find(item => item.name === 'file');
    if (!file || !file.filename) throw createError({ statusCode: 400, message: "Invalid file" });

    // 1. Útvonalak meghatározása
    const ext = path.extname(file.filename);
    const newFilename = `${randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const uploadPath = path.join(uploadDir, newFilename);

    try {
        // 2. Mappa létrehozása, ha nem létezik (recursive: true miatt nem hiba, ha már megvan)
        await fs.mkdir(uploadDir, { recursive: true });

        // 3. Mentés a fájlrendszerbe
        await fs.writeFile(uploadPath, file.data);

        return {
            url: `/uploads/${newFilename}`,
            filename: file.filename
        };
    } catch (err: any) {
        throw createError({
            statusCode: 500,
            message: `Failed to save file: ${err.message}`
        });
    }
});
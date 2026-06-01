import fs from 'node:fs/promises';
import path from 'node:path';

export default defineEventHandler(async (event) => {
    const filename = getRouterParam(event, 'file')!;

    if (!filename || filename.includes('/') || filename.includes('..')) {
        throw createError({ statusCode: 400, message: 'Invalid filename' });
    }

    const filePath = path.join(process.cwd(), '.storage', 'uploads', filename);

    let data: Buffer;
    try {
        data = await fs.readFile(filePath) as Buffer;
    } catch {
        throw createError({ statusCode: 404, message: 'Not found' });
    }

    const ext = path.extname(filename).slice(1).toLowerCase();
    const mimeTypes: Record<string, string> = {
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        pdf: 'application/pdf',
    };
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';

    setHeader(event, 'Content-Type', contentType);
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
    return data;
});

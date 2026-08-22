import fs from 'fs';
import path from 'path';

const UPLOADS_BASE_DIR = path.join(process.cwd(), 'public', 'uploads');

function ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export async function saveFileToRailway(
    data: string | Buffer,
    folder: string,
    filenameWithoutExt: string
): Promise<string> {
    if (!data) return '';

    if (typeof data === 'string' && (data.startsWith('/api/uploads/') || data.startsWith('/uploads/'))) {
        return data;
    }

    const folderPath = path.join(UPLOADS_BASE_DIR, folder);
    ensureDir(folderPath);

    let buffer: Buffer;
    let ext = 'jpg';

    if (Buffer.isBuffer(data)) {
        buffer = data;
    } else if (typeof data === 'string') {
        if (data.startsWith('data:image/')) {
            const match = data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (match) {
                ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                buffer = Buffer.from(match[2], 'base64');
            } else {
                const parts = data.split('base64,');
                buffer = Buffer.from(parts[1] || parts[0], 'base64');
            }
        } else if (data.startsWith('http://') || data.startsWith('https://')) {
            return data;
        } else {
            buffer = Buffer.from(data, 'base64');
        }
    } else {
        throw new Error('Invalid file data provided');
    }

    const cleanFilename = `${filenameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
    const filePath = path.join(folderPath, cleanFilename);

    await fs.promises.writeFile(filePath, buffer);

    return `/api/uploads/${folder}/${cleanFilename}`;
}

export async function getFileFromRailway(folder: string, filename: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const filePath = path.join(UPLOADS_BASE_DIR, folder, filename);
    if (!fs.existsSync(filePath)) return null;

    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
    };

    return {
        buffer,
        contentType: mimeMap[ext] || 'application/octet-stream',
    };
}

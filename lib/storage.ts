import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
];

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];

/**
 * Validate image file buffer and metadata
 */
export function validateImageFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): FileValidationResult {
  // 1. File size check
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: 'File size exceeds the 2MB limit. Please upload a smaller logo.',
    };
  }

  if (buffer.length === 0) {
    return {
      isValid: false,
      error: 'Uploaded file is empty.',
    };
  }

  // 2. Extension check
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: 'Invalid file extension. Allowed formats: PNG, JPG, JPEG, WEBP, SVG.',
    };
  }

  // 3. MIME type check
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      error: 'Invalid image MIME type.',
    };
  }

  // 4. Magic bytes verification
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP';
  const isSvg =
    buffer.slice(0, 100).toString('utf8').includes('<svg') ||
    buffer.slice(0, 100).toString('utf8').includes('<?xml');

  if (!isPng && !isJpg && !isWebp && !isSvg) {
    return {
      isValid: false,
      error: 'File content does not match a valid image signature.',
    };
  }

  return { isValid: true };
}

/**
 * Save logo file buffer to public storage and return the public URL path
 */
export async function saveLogoFile(buffer: Buffer, originalFilename: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(originalFilename).toLowerCase() || '.png';
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const safeFilename = `logo_${Date.now()}_${uniqueId}${ext}`;
  const targetFilePath = path.join(uploadDir, safeFilename);

  await fs.promises.writeFile(targetFilePath, buffer);

  return `/uploads/logos/${safeFilename}`;
}

import { AuthApiError } from './auth.ts';

export type DocumentUpload = {
  id: string;
  purpose: 'document';
  status: 'pending';
  imagePath: string;
};

export async function uploadBusinessDocument(file: File): Promise<DocumentUpload> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.');
  }
  const response = await fetch('/api/uploads?purpose=document', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AuthApiError(response.status, result.error?.code ?? 'UPLOAD_FAILED',
      result.error?.message ?? 'Could not upload the document.');
  }
  return result as DocumentUpload;
}

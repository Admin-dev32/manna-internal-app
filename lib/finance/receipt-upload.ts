const RECEIPT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
const RECEIPT_MAX_SIZE_BYTES = 8 * 1024 * 1024;
const RECEIPT_ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'] as const;

export function normalizeReceiptFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function isAllowedReceiptMimeType(mimeType: string) {
  return RECEIPT_ALLOWED_MIME_TYPES.includes(mimeType as (typeof RECEIPT_ALLOWED_MIME_TYPES)[number]);
}

export function validateReceiptFile(file: File | null) {
  if (!file || file.size <= 0) {
    return { ok: false as const, message: 'Selecciona un archivo de comprobante.' };
  }

  const normalizedFileName = (file.name || '').trim();
  const extensionMatch = normalizedFileName.match(/\.([^.]+)$/);
  const normalizedExtension = extensionMatch?.[1]?.toLowerCase() ?? '';
  if (!normalizedExtension || !RECEIPT_ALLOWED_EXTENSIONS.includes(normalizedExtension as (typeof RECEIPT_ALLOWED_EXTENSIONS)[number])) {
    return { ok: false as const, message: 'Unsupported receipt file extension.' };
  }

  if (!isAllowedReceiptMimeType(file.type || '')) {
    return { ok: false as const, message: 'Formato inválido. Usa PDF, JPG, PNG o WEBP.' };
  }

  if (file.size > RECEIPT_MAX_SIZE_BYTES) {
    return { ok: false as const, message: 'El comprobante excede el límite de 8MB.' };
  }

  return { ok: true as const };
}

export function buildFinanceReceiptStoragePath(expenseId: string, fileName: string, now = Date.now()) {
  const safeName = normalizeReceiptFileName(fileName || `receipt-${now}.bin`) || `receipt-${now}.bin`;
  return `${expenseId}/${now}-${safeName}`;
}

export const financeReceiptUploadConfig = {
  bucket: 'finance-receipts',
  maxSizeBytes: RECEIPT_MAX_SIZE_BYTES,
  allowedMimeTypes: RECEIPT_ALLOWED_MIME_TYPES,
  allowedExtensions: RECEIPT_ALLOWED_EXTENSIONS,
} as const;

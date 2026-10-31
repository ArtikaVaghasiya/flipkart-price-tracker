export type UploadRequestFile = {
  name: string;
  contentType: string;
};

const ALLOWED_EXTENSIONS = /\.(xlsx?|xls)$/i;

export function parseJsonBody<T>(raw: string, context = 'Request body'): T {
  if (raw === null || typeof raw !== 'string' || !raw.trim()) {
    throw new Error(`${context} is empty. Send a valid JSON object with a files array.`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${context} is not valid JSON. Send a JSON object with a files array.`);
  }
}

export function normalizeUploadFiles(files: unknown): UploadRequestFile[] {
  if (!Array.isArray(files)) {
    throw new Error('Request body must include a files array.');
  }

  return files.map((file, index) => {
    if (!file || typeof file !== 'object') {
      throw new Error(`File entry at index ${index} is invalid.`);
    }

    const record = file as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const contentType = typeof record.contentType === 'string' ? record.contentType.trim() : '';

    if (!name) {
      throw new Error(`File entry at index ${index} is missing a name.`);
    }

    if (!ALLOWED_EXTENSIONS.test(name)) {
      throw new Error(`Unsupported file type for "${name}". Only .xls and .xlsx files are allowed.`);
    }

    if (contentType && !/^(application|text)\//i.test(contentType)) {
      throw new Error(`Unsupported content type for "${name}".`);
    }

    return { name, contentType };
  });
}

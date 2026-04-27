export class ClientApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
  }
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await parseJsonSafely<T & { error?: string }>(response);

  if (!response.ok) {
    throw new ClientApiError(
      (payload as { error?: string } | null)?.error || "So'rov bajarilmadi.",
      response.status,
    );
  }

  if (payload === null) {
    throw new ClientApiError("Server bo'sh javob qaytardi.", response.status);
  }

  return payload;
}

export async function apiVoid(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await parseJsonSafely<{ error?: string }>(response);

  if (!response.ok) {
    throw new ClientApiError(payload?.error || "So'rov bajarilmadi.", response.status);
  }

  return payload;
}

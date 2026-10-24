/** Object storage for raw emails, audio, covers and step outputs. */
export interface Storage {
  put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  /** Time-limited URL a podcast app or browser can fetch directly, or null if the driver can't sign. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
}

export async function getJson<T>(storage: Storage, key: string): Promise<T | null> {
  const bytes = await storage.get(key);
  return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as T) : null;
}

export async function putJson(storage: Storage, key: string, value: unknown): Promise<void> {
  await storage.put(key, JSON.stringify(value), "application/json");
}

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Storage } from "./storage";

/** Filesystem storage for local development and tests. */
export function createLocalStorage(rootDir: string): Storage {
  const root = resolve(rootDir);
  const pathFor = (key: string) => {
    const full = resolve(join(root, key));
    if (full !== root && !full.startsWith(root + sep)) throw new Error(`Key escapes storage root: ${key}`);
    return full;
  };
  return {
    async put(key, body) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathFor(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
    async deletePrefix(prefix) {
      await rm(pathFor(prefix), { recursive: true, force: true });
      return 0;
    },
    async signedUrl() {
      return null;
    },
  };
}

import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

const envSchema = z.object({
  DATABASE_URL: z.url(),
  APP_BASE_URL: z.url().default("http://localhost:3000"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(join(tmpdir(), "unread-storage")),
  S3_BUCKET: optional,
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,

  INBOUND_EMAIL_DOMAIN: z.string().default("in.getunread.site"),
  INBOUND_WEBHOOK_SECRET: optional,
  /** Accept mail without an Authentication-Results verdict (Cloudflare already enforces SPF or DKIM). */
  INBOUND_TRUST_UPSTREAM_AUTH: z.stringbool().default(false),

  GEMINI_API_KEY: optional,
  GEMMA_MODEL: z.string().default("gemma-4-31b-it"),
  /** `native` = generateContent; `openai` = the OpenAI-compatible endpoint. */
  GEMINI_API_STYLE: z.enum(["native", "openai"]).default("native"),
  OPENROUTER_API_KEY: optional,
  OPENROUTER_MODEL: z.string().default("google/gemma-4-31b-it"),
  MODEL_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),

  EMBEDDING_MODEL: z.string().default("onnx-community/embeddinggemma-300m-ONNX"),
  /** Where ONNX models are cached (pre-filled in the worker image). */
  MODEL_CACHE_DIR: z.string().default(join(tmpdir(), "unread-models")),
  KOKORO_MODEL: z.string().default("onnx-community/Kokoro-82M-v1.0-ONNX"),
  KOKORO_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  ELEVENLABS_API_KEY: optional,
  FFMPEG_PATH: z.string().default("ffmpeg"),

  SERPAPI_API_KEY: optional,

  BACHS_API_URL: z.url().default("https://sandbox-api.bachs.io"),
  BACHS_API_KEY: optional,
  BACHS_WEBHOOK_SECRET: optional,
  BACHS_PLUS_MONTHLY_PRODUCT_ID: optional,
  BACHS_PLUS_YEARLY_PRODUCT_ID: optional,

  RESEND_API_KEY: optional,
  MAIL_FROM: z.string().default("Unread <hello@getunread.site>"),

  TEMPORAL_ADDRESS: optional,
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_API_KEY: optional,
  TEMPORAL_TASK_QUEUE: z.string().default("unread-episodes"),

  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export type StorageConfig =
  | { driver: "local"; dir: string }
  | { driver: "s3"; bucket: string; region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string };

export interface CoreConfig {
  env: Env;
  storage: StorageConfig;
}

function storageConfig(env: Env): StorageConfig {
  if (env.STORAGE_DRIVER === "local") return { driver: "local", dir: env.STORAGE_LOCAL_DIR };
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  }
  return {
    driver: "s3",
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
}

export function loadConfig(source: Record<string, string | undefined> = process.env): CoreConfig {
  const env = envSchema.parse(source);
  return { env, storage: storageConfig(env) };
}

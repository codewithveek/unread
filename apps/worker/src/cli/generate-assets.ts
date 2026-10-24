import { schema } from "@unread/db";
import { storageKeys } from "@unread/core/storage";
import { elevenLabsClient, generateSoundEffect, SFX_PROMPTS } from "@unread/core/voice/elevenlabs";
import { workerContext } from "../context";
import { parseArgs } from "./args";

/**
 * One-off (prd §8.1): generate the SFX set with ElevenLabs and store it for
 * every episode. Skips sounds that already exist unless --force.
 */
async function main() {
  const force = parseArgs(process.argv.slice(2)).has("force");
  const { db, storage, config } = workerContext();
  const client = elevenLabsClient(config.env.ELEVENLABS_API_KEY);
  const existing = new Set((await db.select({ key: schema.audioAssets.key }).from(schema.audioAssets)).map((r) => r.key));
  for (const key of Object.keys(SFX_PROMPTS) as (keyof typeof SFX_PROMPTS)[]) {
    if (existing.has(key) && !force) {
      console.log(`${key}: exists`);
      continue;
    }
    const mp3 = await generateSoundEffect(client, key);
    const storageKey = storageKeys.asset(`${key}.mp3`);
    await storage.put(storageKey, mp3, "audio/mpeg");
    await db
      .insert(schema.audioAssets)
      .values({ key, storageKey, durationS: SFX_PROMPTS[key].durationSeconds })
      .onConflictDoUpdate({ target: schema.audioAssets.key, set: { storageKey, createdAt: new Date() } });
    console.log(`${key}: ${mp3.byteLength} bytes`);
  }
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Repo layout is <root>/packages/core/dist/voice.js at runtime, so three
// levels up from this compiled file lands back at <root>/voice.md.
const VOICE_PATH =
  process.env.DAYBOOK_VOICE_PATH ||
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "voice.md");

const FALLBACK_VOICE =
  "Poetic, spiritually grounded, first-person. Ties technical work to a larger arc. Understated confidence, not hype.";

export function loadVoice(): string {
  try {
    return readFileSync(VOICE_PATH, "utf-8").trim();
  } catch {
    return FALLBACK_VOICE;
  }
}

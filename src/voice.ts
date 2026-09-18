import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VOICE_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "voice.md");

const FALLBACK_VOICE =
  "Poetic, spiritually grounded, first-person. Ties technical work to a larger arc. Understated confidence, not hype.";

export function loadVoice(): string {
  try {
    return readFileSync(VOICE_PATH, "utf-8").trim();
  } catch {
    return FALLBACK_VOICE;
  }
}

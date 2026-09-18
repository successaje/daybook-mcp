export const PLATFORM_RULES: Record<"x" | "medium" | "linkedin", string> = {
  x: "Short-form and punchy, first-person. Under 280 characters unless the material genuinely calls for a thread (in which case, number each tweet). No hashtags unless one is truly load-bearing.",
  medium:
    "Long-form. A technical-and-personal blend, poetic and reflective. Tie the day's/week's technical work to a larger theme or arc rather than just recapping tasks.",
  linkedin:
    "Strictly professional. Suspend the poetic voice entirely — no metaphor, no spiritual framing. Frame the work as an achievement or insight for a career-minded audience: what was built, what it took, what it signals.",
};

export function formatEntriesForPrompt(
  entries: { timestamp: string; project_tag: string | null; text: string }[]
): string {
  return entries
    .slice()
    .reverse()
    .map((e) => `- [${e.timestamp}]${e.project_tag ? ` (${e.project_tag})` : ""} ${e.text}`)
    .join("\n");
}

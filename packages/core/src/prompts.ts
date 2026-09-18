export const PLATFORM_RULES: Record<"x" | "medium" | "linkedin", string> = {
  x: "Short-form and punchy, first-person. Under 280 characters unless the material genuinely calls for a thread (in which case, number each tweet). No hashtags unless one is truly load-bearing.",
  medium:
    "Long-form. A technical-and-personal blend, poetic and reflective. Tie the day's/week's technical work to a larger theme or arc rather than just recapping tasks.",
  linkedin:
    "Strictly professional. Suspend the poetic voice entirely — no metaphor, no spiritual framing. Frame the work as an achievement or insight for a career-minded audience: what was built, what it took, what it signals.",
};

export function formatEntriesForPrompt(
  entries: { timestamp: string; project_tag: string | null; text: string; milestone?: number }[]
): string {
  return entries
    .slice()
    .reverse()
    .map(
      (e) =>
        `- ${e.milestone ? "★ MILESTONE " : ""}[${e.timestamp}]${
          e.project_tag ? ` (${e.project_tag})` : ""
        } ${e.text}`
    )
    .join("\n");
}

export const MILESTONE_GUIDANCE =
  "Whenever logged work represents a completed feature, a resolved hard problem, a shipped " +
  "release, or another milestone — not routine progress — log it with milestone set to true, " +
  "then immediately (without being asked) tell the user this seems like good material for a " +
  "post: name which platform fits best (X for a quick technical win, LinkedIn for a " +
  "professional achievement worth a career audience, Medium for something with a bigger " +
  "reflective arc) and why, in one or two sentences. Offer to draft it, but wait for their " +
  "go-ahead before generating anything. Never draft, copy, or post anything without being " +
  "asked, and never post on the user's behalf at all — copying, editing, and posting the " +
  "finished draft is entirely up to them.";

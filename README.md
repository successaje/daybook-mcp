# daybook-mcp

Local-first tooling for logging daily activities and generating daily
summaries, weekly article ideas, and platform-specific social posts from
those logs — through Claude.

Single-user, no hosting, no auth. Storage is a single SQLite file at
`~/.daybook/daybook.db`, created on first run.

This is an npm workspaces monorepo with three packages:

- **[`packages/core`](./packages/core)** — `@daybook/core`. The shared
  SQLite schema, queries, voice loading, and platform tone rules. Not used
  directly; both interfaces below depend on it.
- **[`packages/mcp-server`](./packages/mcp-server)** — `daybook-mcp`, a
  stdio MCP server. Register it once with your MCP host and its tools show
  up automatically — but the host has to be restarted to pick up a newly
  registered server.
- **[`packages/skill`](./packages/skill)** — `@daybook/skill`, a Claude
  Code Skill that exposes the identical functionality through a small
  bundled CLI instead of MCP tool calls. Loads instantly via the Skill
  tool, no restart needed. Same database, same schema — use whichever
  fits your session.

## Setup

```bash
npm install
npm run build
```

This builds all three packages (`core` first, since the other two depend
on it).

## Using the MCP server

Register it with Claude Code:

```bash
claude mcp add daybook -- node /path/to/daybook-mcp/packages/mcp-server/dist/index.js
```

This writes the server entry into Claude Code's own config — `~/.claude.json`
under this project's entry, not a file in this repo — so there's nothing
to commit for it, unlike the skill's `.claude/skills/daybook` symlink
(see "Using the skill" below).

Or add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "daybook": {
      "command": "node",
      "args": ["/path/to/daybook-mcp/packages/mcp-server/dist/index.js"]
    }
  }
}
```

**Note:** MCP hosts load registered servers at session startup, so after
registering (or after `packages/mcp-server` code changes and a rebuild),
start a new session before the tools appear.

## Using the skill

The repo ships a symlink at `.claude/skills/daybook` pointing at
`packages/skill`, so if you clone this repo and open it in Claude Code,
the skill is auto-discovered — no registration step. To use it from a
different project, copy or symlink `packages/skill` into that project's
own `.claude/skills/<name>/` directory instead.

Either way, once it's built (`npm run build`, which also builds the CLI to
`packages/skill/scripts/cli.js`), it's available immediately — no restart.

## Usage

Once either interface is set up, just talk to Claude normally. You don't
need to name tools or commands — describe what you want:

- **"Log that I fixed the flaky auth test today"** — logs an activity note.
- **"What did I get done this week?"** — fetches raw entries for a range.
- **"Summarize my day"** — pulls today's entries, drafts a short recap in
  your configured voice, and stores it.
- **"Draft a tweet about today"** / **"turn this week into a LinkedIn
  post"** — pulls the relevant entries/summaries, drafts a post following
  that platform's tone rules, and stores it as a draft for your review.
- **"Show me my drafts"** / **"mark draft 3 as posted"** — list and update
  stored drafts.
- **"Give me a weekly review"** — reads the last 7 days of summaries and
  proposes the single strongest article angle from the week, as a title +
  bullet outline. This is exploratory and is never saved automatically.

Because the generation tools are two-phase (see below), you'll see Claude
fetch material first, draft the text itself in your voice, then store it —
rather than a black box handing back finished text. That's deliberate: you
can watch it happen and redirect mid-draft if the tone is off.

### Proactive milestone suggestions

You don't have to remember to ask for a post. Whenever something logged
represents a completed feature, a resolved hard problem, a shipped
release, or another genuine milestone — not routine progress — Claude is
instructed to flag it and tell you, unprompted, that it seems worth a
post: which platform fits and why, in a line or two. It then waits for you
to say yes before drafting anything, and it never posts on your behalf —
copying, editing, and actually publishing the finished draft stays
entirely your call.

This works the same way in both interfaces: the MCP server advertises it
as standing server `instructions` (plus in `log_entry`'s own description),
and the skill carries the identical guidance in `SKILL.md`. Milestone
entries are stored with a flag (`milestone: true` / `--milestone`) so they
also surface prominently — marked `★ MILESTONE` — in `generate_post`
material and in `weekly_review`, which weighs them heavily when picking
the week's strongest angle. You can also flag something as a milestone
after the fact with `flag_milestone` / `flag-milestone <entry_id>`, if its
significance only becomes clear later.

## Tools / commands

Both interfaces expose the same nine operations:

- `log_entry` / `log` — log a raw activity note. Accepts an optional
  `milestone` flag for genuinely significant work (see above).
- `flag_milestone` / `flag-milestone` — retroactively mark an existing
  entry as a milestone.
- `get_entries` / `entries` — fetch raw entries in a date range.
- `generate_daily_summary` / `summary` — two-phase: call without the
  drafted text to get the day's entries plus drafting instructions; call
  again with the text to store it.
- `generate_post` / `post` — two-phase, same pattern. Platform is `x`,
  `medium`, or `linkedin`, each with its own tone rules.
- `list_drafts` / `drafts` — list stored drafts, optionally filtered by
  `draft`/`posted`.
- `update_draft` / `update-draft` — overwrite a stored draft's content in
  place, for when the wording needs a pass before it goes out.
- `mark_posted` / `mark-posted` — flip a draft's status to `posted`.
- `weekly_review` / `review` — pulls the last 7 days of summaries and asks
  you to identify the week's strongest article angle as an outline.
  Nothing is stored; the outline is just the reply.

The two-phase design exists because MCP's server-initiated "sampling"
isn't yet supported by Claude Code or Claude Desktop — so instead of the
server calling an LLM itself (which would need a separate API key), the
tool hands back the raw material and lets the Claude you're already
talking to do the writing, then a second call persists it.

## Voice

Edit [`voice.md`](./voice.md) at the repo root to tune the authorial voice
used across summaries and posts — both interfaces read from the same file.
Platform-specific tone rules (length, formality) live in
[`packages/core/src/prompts.ts`](./packages/core/src/prompts.ts).

## Why Node, not Bun

`better-sqlite3`'s native binding doesn't load under Bun's runtime yet. The
project uses Node instead (Node 22+ can run the TypeScript sources directly
via `node --experimental-strip-types`, or build with `npm run build` and
run the compiled output).

## Contributing

Contributions are welcome — bug fixes, new platform tone rules, additional
commands, whatever's useful. See [CONTRIBUTING.md](./CONTRIBUTING.md) for
the project layout, dev setup, and how to keep the MCP server and the
skill in sync when adding a capability.

## License

MIT — see [LICENSE](./LICENSE).

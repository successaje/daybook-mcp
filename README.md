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

Point Claude Code at `packages/skill/SKILL.md` (copy it into your skills
directory, or reference it directly) and it will drive the same
functionality through `node packages/skill/scripts/cli.js <command>`. No
registration or restart required — it's available as soon as the skill is
loaded.

## Tools / commands

Both interfaces expose the same seven operations:

- `log_entry` / `log` — log a raw activity note.
- `get_entries` / `entries` — fetch raw entries in a date range.
- `generate_daily_summary` / `summary` — two-phase: call without the
  drafted text to get the day's entries plus drafting instructions; call
  again with the text to store it.
- `generate_post` / `post` — two-phase, same pattern. Platform is `x`,
  `medium`, or `linkedin`, each with its own tone rules.
- `list_drafts` / `drafts` — list stored drafts, optionally filtered by
  `draft`/`posted`.
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

## License

MIT — see [LICENSE](./LICENSE).

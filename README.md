# daybook-mcp

Local-first MCP server for logging daily activities and generating daily
summaries, weekly article ideas, and platform-specific social posts from
those logs — through Claude.

Single-user, stdio transport, no hosting or auth. Storage is a single SQLite
file at `~/.daybook/daybook.db`, created on first run.

## Setup

```bash
npm install
npm run build
```

## Register with Claude Code

```bash
claude mcp add daybook -- node /Users/finisher/Documents/github/daybook-mcp/dist/index.js
```

Or add to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "daybook": {
      "command": "node",
      "args": ["/Users/finisher/Documents/github/daybook-mcp/dist/index.js"]
    }
  }
}
```

## Tools

- `log_entry(text, project_tag?)` — log a raw activity note.
- `get_entries(start_date, end_date)` — fetch raw entries in a date range.
- `generate_daily_summary(date, summary?)` — two-phase: call without
  `summary` to get the day's entries plus drafting instructions; write the
  summary yourself, then call again with `summary` filled in to store it.
- `generate_post(start_date, end_date, platform, content?)` — two-phase,
  same pattern as above. `platform` is `x`, `medium`, or `linkedin`.
- `list_drafts(status?)` — list stored drafts, optionally filtered by
  `draft`/`posted`.
- `mark_posted(draft_id)` — flip a draft's status to `posted`.
- `weekly_review()` — pulls the last 7 days of summaries and asks you to
  identify the week's strongest article angle as an outline. Nothing is
  stored; the outline is just your reply.

The two-phase tools exist because MCP's server-initiated "sampling" isn't
yet supported by Claude Code or Claude Desktop — so instead of the server
calling an LLM itself (which would need a separate API key), the tool hands
back the raw material and lets the Claude you're already talking to do the
writing, then a second call persists it.

## Voice

Edit [`voice.md`](./voice.md) to tune the authorial voice used across
summaries and posts. Platform-specific tone rules (length, formality) live
in [`src/prompts.ts`](./src/prompts.ts).

## Why Node, not Bun

`better-sqlite3`'s native binding doesn't load under Bun's runtime yet. The
project uses Node instead (Node 22+ can run the TypeScript sources directly
via `node --experimental-strip-types`, or build with `npm run build` and run
`dist/`).

## License

MIT — see [LICENSE](./LICENSE).

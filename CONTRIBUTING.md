# Contributing to daybook-mcp

Thanks for considering a contribution. This is a small, personal-scale
tool, so the bar is "keep it simple and keep both interfaces honest" more
than any heavyweight process.

## Project layout

npm workspaces monorepo, three packages:

- **`packages/core`** (`@daybook/core`) — the SQLite schema, all queries,
  voice loading (`voice.md`), and platform tone rules
  (`packages/core/src/prompts.ts`). This is the only place storage or
  prompt logic should live.
- **`packages/mcp-server`** (`daybook-mcp`) — the stdio MCP server. Thin:
  each tool validates input, calls into `@daybook/core`, and formats the
  response.
- **`packages/skill`** (`@daybook/skill`) — a Claude Code Skill exposing
  the same functionality as a CLI (`src/cli.ts`, built to
  `scripts/cli.js`). Also thin, for the same reason.

Both `mcp-server` and `skill` are consumers of `core`, not independent
implementations. **If you're adding a new capability, implement it once in
`packages/core`, then add a thin wrapper in both the MCP tool and the CLI
subcommand.** Letting the two consumers drift — say, a tone rule that only
exists in the MCP server's prompt text — is the main way this project rots.
If a change only makes sense for one interface, that's fine, but it should
be a deliberate call, not an oversight.

## Dev setup

```bash
git clone https://github.com/successaje/daybook-mcp.git
cd daybook-mcp
npm install
npm run build
```

This builds `core` first (the other two packages depend on its compiled
output), then `mcp-server`, then `skill`.

Requires Node 22+ (better-sqlite3's native binding doesn't load under
Bun's runtime — see the README's "Why Node, not Bun" section if you're
tempted to switch it back).

## Testing your changes

There's no test suite yet (contributions adding one are welcome). In
practice, changes have been verified by driving each package directly:

**MCP server** — spawn it and speak raw JSON-RPC over stdio, e.g. with the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector), or a
small script that pipes `initialize` / `tools/call` requests to
`node packages/mcp-server/dist/index.js` and reads the responses back.

**Skill CLI** — just run it directly:

```bash
node packages/skill/scripts/cli.js log "test entry" --tag test
node packages/skill/scripts/cli.js entries --start 2026-01-01 --end 2026-12-31
```

Both packages read/write the same `~/.daybook/daybook.db`, so you can
cross-check that a change behaves identically from either interface. If
you're testing against your real daybook, clean up any test rows you add
(there's no `--dry-run` flag) — a quick `sqlite3 ~/.daybook/daybook.db`
session or a one-off `DELETE` covers it.

If you're iterating on the skill specifically, note that Claude Code
picks up changes to `packages/skill/SKILL.md` and the CLI live in an
already-running session — no restart needed. The MCP server does need a
session restart after code changes, since MCP connections are established
once at session startup.

## Code style

- TypeScript, strict mode, ES modules (`NodeNext`).
- Minimal dependencies — this project deliberately avoids adding a CLI
  framework, an LLM SDK, or similar conveniences where a short hand-rolled
  version does the job. If you're adding a dependency, make the case for
  it in the PR description.
- No comments explaining *what* code does — only *why*, and only when it's
  genuinely non-obvious (a workaround, a hidden constraint).

## Submitting a change

1. Fork and branch from `master`.
2. Keep the diff focused — one logical change per PR.
3. If you touched behavior shared between the MCP server and the skill,
   confirm both still work (see Testing above).
4. Open a PR describing what changed and why.

All contributions are made under the project's [MIT license](./LICENSE).

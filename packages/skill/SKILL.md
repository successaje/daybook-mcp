---
name: daybook
description: Log daily activity notes and generate daily summaries, weekly article-angle reviews, and platform-specific posts (X, Medium, LinkedIn) from them, in the user's own configured voice. Use this whenever the user wants to log what they did today, record a work note, summarize their day, review the past week's work for a strongest article angle, or draft a post/tweet/article about their recent work — even if they don't say "daybook" by name. Trigger on phrases like "log this", "note that I...", "summarize my day", "what did I do today", "weekly review", "draft a tweet about today", "write a LinkedIn post about this week", "turn this into a Medium post", or "mark that post as posted". This is a CLI-backed alternative to the daybook-mcp MCP server — prefer this skill when the MCP server isn't registered/loaded in the current session.
---

# Daybook

A local, single-user activity log backed by SQLite at `~/.daybook/daybook.db`
(shared with the `daybook-mcp` MCP server — same database, same schema, use
either interchangeably). This skill drives it through a small bundled CLI
instead of MCP tool calls, so it works immediately with no session restart.

Run everything through the CLI at `scripts/cli.js` from this skill's
directory, using the Bash tool:

```bash
node scripts/cli.js <command> [options]
```

If `scripts/cli.js` doesn't exist yet (first use, or after a fresh clone),
build it once from the package root:

```bash
npm install && npm run build
```

## Commands

### Log an activity note

```bash
node scripts/cli.js log "<text>" [--tag <project_tag>]
```

Use this the moment the user mentions something they did, decided, or
noticed — don't wait to be asked to "log" explicitly if the intent is clear
("just fixed the auth bug" said in passing is worth logging if the user is
using this skill to track their work).

### Fetch raw entries

```bash
node scripts/cli.js entries --start <YYYY-MM-DD> --end <YYYY-MM-DD>
```

Returns raw logged entries in that range, newest first.

### Generate a daily summary (two-phase)

This is a two-step flow because the writing itself is yours to do, in the
voice described below — the CLI only fetches material and stores your
result, it never generates text on its own.

**Step 1 — fetch material:**

```bash
node scripts/cli.js summary --date <YYYY-MM-DD>
```

This prints that day's entries and the voice to write in. If it says there
are no entries for that date, tell the user rather than inventing content.

**Step 2 — draft and store:**

Write a short recap (3-6 sentences, or a tight bulleted list) based only on
what the entries actually say, in the given voice. Then store it:

```bash
node scripts/cli.js summary --date <YYYY-MM-DD> --text "<your drafted summary>"
```

### Generate a platform post (two-phase)

Same two-step pattern as summaries. `--platform` is one of `x`, `medium`,
or `linkedin` — each has different tone rules the CLI will print for you
in step 1 (X is short and punchy, Medium is long-form and reflective,
LinkedIn is strictly professional with no poetic voice). Follow whichever
rules come back; don't apply X's brevity to a LinkedIn post or vice versa.

**Step 1 — fetch material + tone rules:**

```bash
node scripts/cli.js post --start <YYYY-MM-DD> --end <YYYY-MM-DD> --platform <x|medium|linkedin>
```

**Step 2 — draft and store as a draft:**

```bash
node scripts/cli.js post --start <YYYY-MM-DD> --end <YYYY-MM-DD> --platform <x|medium|linkedin> --text "<your drafted post>"
```

This stores the post with status `draft` — it is not posted anywhere. Show
the user the draft and let them decide what to do with it.

### List drafts

```bash
node scripts/cli.js drafts [--status draft|posted]
```

### Mark a draft as posted

Only do this when the user confirms they've actually posted it somewhere —
this tool has no way to verify that itself.

```bash
node scripts/cli.js mark-posted <draft_id>
```

### Weekly review

```bash
node scripts/cli.js review
```

Pulls the last 7 days of stored daily summaries and prints them along with
the voice to write in. Read them, pick the single strongest article angle
from the week's actual work, and reply directly to the user with an outline
(a title plus 3-5 supporting bullets). **Do not run the `post` command to
store this as a draft** — a weekly review outline is exploratory and stays
in the conversation unless the user separately asks you to turn it into an
actual post.

## Voice

The voice used for summaries and posts comes from `voice.md` at the repo
root (three levels up from this skill's `scripts/` directory) and is
printed as part of each command's output — you don't need to read the file
yourself, just follow what the CLI prints. If the user wants to change the
tone permanently, tell them to edit `voice.md`; that's the one file this
whole system reads its voice from.

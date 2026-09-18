#!/usr/bin/env node
import {
  insertEntry,
  getEntriesInRange,
  insertSummary,
  getSummariesInRange,
  insertDraft,
  listDrafts,
  markDraftPosted,
  loadVoice,
  PLATFORM_RULES,
  formatEntriesForPrompt,
} from "@daybook/core";

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

function lastWeekRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

const USAGE = `Usage: cli.js <command> [options]

Commands:
  log "<text>" [--tag <project_tag>]
  entries --start <date> --end <date>
  summary --date <date> [--text "<summary>"]
  post --start <date> --end <date> --platform <x|medium|linkedin> [--text "<content>"]
  drafts [--status draft|posted]
  mark-posted <draft_id>
  review
`;

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case "log": {
      const text = positional[0];
      if (!text) fail('Usage: log "<text>" [--tag <project_tag>]');
      const entry = insertEntry(text, str(flags, "tag"));
      console.log(
        `Logged entry #${entry.id} at ${entry.timestamp}${
          entry.project_tag ? ` [${entry.project_tag}]` : ""
        }: ${entry.text}`
      );
      break;
    }

    case "entries": {
      const start = str(flags, "start");
      const end = str(flags, "end");
      if (!start || !end) fail("Usage: entries --start <date> --end <date>");
      const entries = getEntriesInRange(start, end);
      if (entries.length === 0) {
        console.log(`No entries found between ${start} and ${end}.`);
        break;
      }
      for (const e of entries) {
        console.log(
          `#${e.id} [${e.timestamp}]${e.project_tag ? ` (${e.project_tag})` : ""}: ${e.text}`
        );
      }
      break;
    }

    case "summary": {
      const date = str(flags, "date");
      if (!date) fail("Usage: summary --date <date> [--text \"<summary>\"]");
      const entries = getEntriesInRange(date, date);
      if (entries.length === 0) fail(`No entries logged for ${date}.`);

      const text = str(flags, "text");
      if (text === undefined) {
        const voice = loadVoice();
        console.log(
          `Draft a short daily recap for ${date} (3-6 sentences, or a tight bulleted recap), ` +
            `written in the author's own voice, based only on the entries below — don't invent details.\n\n` +
            `Voice: ${voice}\n\n` +
            `Entries for ${date}:\n${formatEntriesForPrompt(entries)}\n\n` +
            `Once you've written the summary, run:\n` +
            `  node scripts/cli.js summary --date ${date} --text "<your text>"`
        );
      } else {
        const stored = insertSummary(date, text);
        console.log(`Stored daily summary #${stored.id} for ${date}:\n\n${stored.content}`);
      }
      break;
    }

    case "post": {
      const start = str(flags, "start");
      const end = str(flags, "end");
      const platform = str(flags, "platform") as keyof typeof PLATFORM_RULES | undefined;
      if (!start || !end || !platform) {
        fail("Usage: post --start <date> --end <date> --platform <x|medium|linkedin> [--text \"<content>\"]");
      }
      if (!(platform in PLATFORM_RULES)) {
        fail(`Unknown platform "${platform}". Must be one of: x, medium, linkedin.`);
      }

      const entries = getEntriesInRange(start, end);
      const summaries = getSummariesInRange(start, end);
      if (entries.length === 0 && summaries.length === 0) {
        fail(`No entries or summaries found between ${start} and ${end}.`);
      }

      const text = str(flags, "text");
      if (text === undefined) {
        const voice = loadVoice();
        const platformRule = PLATFORM_RULES[platform];
        const entryLines = entries.length > 0 ? formatEntriesForPrompt(entries) : "(none)";
        const summaryLines =
          summaries.length > 0
            ? summaries
                .slice()
                .reverse()
                .map((s) => `- [${s.date}] ${s.content}`)
                .join("\n")
            : "(none)";

        console.log(
          `Draft a ${platform} post covering ${start} to ${end}.\n\n` +
            `Base voice: ${voice}\n\n` +
            `Platform tone rules for ${platform}: ${platformRule}\n\n` +
            `Daily summaries in range:\n${summaryLines}\n\n` +
            `Raw entries in range:\n${entryLines}\n\n` +
            `Once you've written the post, run:\n` +
            `  node scripts/cli.js post --start ${start} --end ${end} --platform ${platform} --text "<your text>"`
        );
      } else {
        const stored = insertDraft(start, end, platform, text);
        console.log(
          `Stored draft #${stored.id} for ${platform} (${start} to ${end}), status: ${stored.status}:\n\n` +
            stored.content
        );
      }
      break;
    }

    case "drafts": {
      const status = str(flags, "status");
      const drafts = listDrafts(status);
      if (drafts.length === 0) {
        console.log(status ? `No drafts with status "${status}".` : "No drafts stored yet.");
        break;
      }
      for (const d of drafts) {
        console.log(
          `#${d.id} [${d.platform}] ${d.date_range_start}..${d.date_range_end} (${d.status}, created ${d.created_at}):\n${d.content}\n`
        );
      }
      break;
    }

    case "mark-posted": {
      const id = Number(positional[0]);
      if (!id) fail("Usage: mark-posted <draft_id>");
      const updated = markDraftPosted(id);
      if (!updated) fail(`No draft found with id ${id}.`);
      console.log(`Draft #${updated.id} marked as posted.`);
      break;
    }

    case "review": {
      const { startDate, endDate } = lastWeekRange();
      const summaries = getSummariesInRange(startDate, endDate);
      if (summaries.length === 0) {
        fail(
          `No daily summaries found between ${startDate} and ${endDate}. ` +
            `Generate some with the summary command first.`
        );
      }
      const voice = loadVoice();
      const summaryLines = summaries
        .slice()
        .reverse()
        .map((s) => `- [${s.date}] ${s.content}`)
        .join("\n");
      console.log(
        `Review the past week's daily summaries (${startDate} to ${endDate}) below and identify ` +
          `the single strongest article angle from the week's work. Respond with an outline: a title ` +
          `and 3-5 supporting bullets, in the voice given. This is exploratory — do not save it as a draft.\n\n` +
          `Voice: ${voice}\n\n` +
          `Summaries:\n${summaryLines}`
      );
      break;
    }

    default:
      console.log(USAGE);
      if (command) process.exit(1);
  }
}

main();

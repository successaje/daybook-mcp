#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  insertEntry,
  getEntriesInRange,
  insertSummary,
  getSummariesInRange,
  insertDraft,
  listDrafts,
  markDraftPosted,
} from "./db.js";
import { loadVoice } from "./voice.js";
import { PLATFORM_RULES } from "./prompts.js";

const server = new McpServer({
  name: "daybook-mcp",
  version: "0.1.0",
});

server.registerTool(
  "log_entry",
  {
    title: "Log Entry",
    description:
      "Insert a raw activity note into the daybook with the current timestamp.",
    inputSchema: {
      text: z.string().min(1).describe("The activity note text to log."),
      project_tag: z
        .string()
        .optional()
        .describe("Optional short tag identifying the project/context."),
    },
  },
  async ({ text, project_tag }) => {
    const entry = insertEntry(text, project_tag);
    return {
      content: [
        {
          type: "text",
          text: `Logged entry #${entry.id} at ${entry.timestamp}${
            entry.project_tag ? ` [${entry.project_tag}]` : ""
          }: ${entry.text}`,
        },
      ],
    };
  }
);

server.registerTool(
  "get_entries",
  {
    title: "Get Entries",
    description:
      "Return raw activity entries within a date range (inclusive), newest first.",
    inputSchema: {
      start_date: z.string().describe("Start date, YYYY-MM-DD."),
      end_date: z.string().describe("End date, YYYY-MM-DD."),
    },
  },
  async ({ start_date, end_date }) => {
    const entries = getEntriesInRange(start_date, end_date);
    if (entries.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No entries found between ${start_date} and ${end_date}.`,
          },
        ],
      };
    }
    const lines = entries.map(
      (e) =>
        `#${e.id} [${e.timestamp}]${e.project_tag ? ` (${e.project_tag})` : ""}: ${e.text}`
    );
    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

function formatEntriesForPrompt(
  entries: { timestamp: string; project_tag: string | null; text: string }[]
): string {
  return entries
    .slice()
    .reverse()
    .map((e) => `- [${e.timestamp}]${e.project_tag ? ` (${e.project_tag})` : ""} ${e.text}`)
    .join("\n");
}

server.registerTool(
  "generate_daily_summary",
  {
    title: "Generate Daily Summary",
    description:
      "Two-phase tool. Call with just `date` to fetch that day's entries and get drafting " +
      "instructions — write the summary yourself, in the voice provided, from the returned entries. " +
      "Then call this tool again with the same `date` plus `summary` set to your drafted text, " +
      "which stores it and returns confirmation.",
    inputSchema: {
      date: z.string().describe("The date to summarize, YYYY-MM-DD."),
      summary: z
        .string()
        .optional()
        .describe(
          "The drafted summary text. Omit on the first call to fetch entries + instructions; " +
            "provide on the second call to store it."
        ),
    },
  },
  async ({ date, summary }) => {
    const entries = getEntriesInRange(date, date);
    if (entries.length === 0) {
      return {
        content: [{ type: "text", text: `No entries logged for ${date}.` }],
        isError: true,
      };
    }

    if (summary === undefined) {
      const voice = loadVoice();
      const entryLines = formatEntriesForPrompt(entries);
      return {
        content: [
          {
            type: "text",
            text:
              `Draft a short daily recap for ${date} (3-6 sentences, or a tight bulleted recap), ` +
              `written in the author's own voice, based only on the entries below — don't invent details.\n\n` +
              `Voice: ${voice}\n\n` +
              `Entries for ${date}:\n${entryLines}\n\n` +
              `Once you've written the summary, call generate_daily_summary again with date="${date}" ` +
              `and summary=<your text> to store it.`,
          },
        ],
      };
    }

    const stored = insertSummary(date, summary);
    return {
      content: [
        {
          type: "text",
          text: `Stored daily summary #${stored.id} for ${date}:\n\n${stored.content}`,
        },
      ],
    };
  }
);

const PLATFORM_ENUM = z.enum(["x", "medium", "linkedin"]);

server.registerTool(
  "generate_post",
  {
    title: "Generate Platform Post",
    description:
      "Two-phase tool. Call with `start_date`, `end_date`, `platform` to fetch entries/summaries " +
      "in that range plus platform-specific tone instructions — draft the post yourself accordingly. " +
      "Then call this tool again with the same range/platform plus `content` set to your draft, " +
      "which stores it as a draft and returns confirmation.",
    inputSchema: {
      start_date: z.string().describe("Start date, YYYY-MM-DD."),
      end_date: z.string().describe("End date, YYYY-MM-DD."),
      platform: PLATFORM_ENUM.describe("Target platform: x, medium, or linkedin."),
      content: z
        .string()
        .optional()
        .describe(
          "The drafted post text. Omit on the first call to fetch material + instructions; " +
            "provide on the second call to store it as a draft."
        ),
    },
  },
  async ({ start_date, end_date, platform, content }) => {
    const entries = getEntriesInRange(start_date, end_date);
    const summaries = getSummariesInRange(start_date, end_date);

    if (entries.length === 0 && summaries.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No entries or summaries found between ${start_date} and ${end_date}.`,
          },
        ],
        isError: true,
      };
    }

    if (content === undefined) {
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

      return {
        content: [
          {
            type: "text",
            text:
              `Draft a ${platform} post covering ${start_date} to ${end_date}.\n\n` +
              `Base voice: ${voice}\n\n` +
              `Platform tone rules for ${platform}: ${platformRule}\n\n` +
              `Daily summaries in range:\n${summaryLines}\n\n` +
              `Raw entries in range:\n${entryLines}\n\n` +
              `Once you've written the post, call generate_post again with start_date="${start_date}", ` +
              `end_date="${end_date}", platform="${platform}", and content=<your text> to store it as a draft.`,
          },
        ],
      };
    }

    const stored = insertDraft(start_date, end_date, platform, content);
    return {
      content: [
        {
          type: "text",
          text:
            `Stored draft #${stored.id} for ${platform} (${start_date} to ${end_date}), status: ${stored.status}:\n\n` +
            stored.content,
        },
      ],
    };
  }
);

server.registerTool(
  "list_drafts",
  {
    title: "List Drafts",
    description: "List stored drafts, optionally filtered by status.",
    inputSchema: {
      status: z
        .enum(["draft", "posted"])
        .optional()
        .describe("Filter to only this status. Omit to list all drafts."),
    },
  },
  async ({ status }) => {
    const drafts = listDrafts(status);
    if (drafts.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: status ? `No drafts with status "${status}".` : "No drafts stored yet.",
          },
        ],
      };
    }
    const lines = drafts.map(
      (d) =>
        `#${d.id} [${d.platform}] ${d.date_range_start}..${d.date_range_end} (${d.status}, created ${d.created_at}):\n${d.content}`
    );
    return {
      content: [{ type: "text", text: lines.join("\n\n") }],
    };
  }
);

server.registerTool(
  "mark_posted",
  {
    title: "Mark Draft Posted",
    description: "Flip a stored draft's status to 'posted'.",
    inputSchema: {
      draft_id: z.number().int().describe("The id of the draft to mark as posted."),
    },
  },
  async ({ draft_id }) => {
    const updated = markDraftPosted(draft_id);
    if (!updated) {
      return {
        content: [{ type: "text", text: `No draft found with id ${draft_id}.` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Draft #${updated.id} marked as posted.`,
        },
      ],
    };
  }
);

server.registerTool(
  "weekly_review",
  {
    title: "Weekly Review",
    description:
      "Pull the last 7 days of daily summaries and get instructions to identify the single " +
      "strongest article angle from the week, as an outline (title + 3-5 bullets). This does not " +
      "store anything — write the outline directly as your reply to the user.",
    inputSchema: {},
  },
  async () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const summaries = getSummariesInRange(startDate, endDate);
    if (summaries.length === 0) {
      return {
        content: [
          {
            type: "text",
            text:
              `No daily summaries found between ${startDate} and ${endDate}. ` +
              `Generate some with generate_daily_summary first.`,
          },
        ],
        isError: true,
      };
    }

    const voice = loadVoice();
    const summaryLines = summaries
      .slice()
      .reverse()
      .map((s) => `- [${s.date}] ${s.content}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text:
            `Review the past week's daily summaries (${startDate} to ${endDate}) below and identify ` +
            `the single strongest article angle from the week's work. Respond with an outline: a title ` +
            `and 3-5 supporting bullets, in the voice given. This is exploratory — do not save it as a draft.\n\n` +
            `Voice: ${voice}\n\n` +
            `Summaries:\n${summaryLines}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("daybook-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting daybook-mcp:", err);
  process.exit(1);
});

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DAYBOOK_DIR = join(homedir(), ".daybook");
const DB_PATH = join(DAYBOOK_DIR, "daybook.db");

mkdirSync(DAYBOOK_DIR, { recursive: true });

export const db: import("better-sqlite3").Database = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    text TEXT NOT NULL,
    project_tag TEXT,
    source TEXT
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    generated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_range_start TEXT NOT NULL,
    date_range_end TEXT NOT NULL,
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries (timestamp);
  CREATE INDEX IF NOT EXISTS idx_summaries_date ON summaries (date);
`);

const entryColumns = db.prepare(`PRAGMA table_info(entries)`).all() as { name: string }[];
if (!entryColumns.some((c) => c.name === "milestone")) {
  db.exec(`ALTER TABLE entries ADD COLUMN milestone INTEGER NOT NULL DEFAULT 0`);
}

export interface EntryRow {
  id: number;
  timestamp: string;
  text: string;
  project_tag: string | null;
  source: string | null;
  milestone: number;
}

export interface SummaryRow {
  id: number;
  date: string;
  content: string;
  generated_at: string;
}

export interface DraftRow {
  id: number;
  date_range_start: string;
  date_range_end: string;
  platform: string;
  content: string;
  status: string;
  created_at: string;
}

export function insertEntry(
  text: string,
  projectTag?: string,
  source?: string,
  milestone?: boolean
): EntryRow {
  const timestamp = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO entries (timestamp, text, project_tag, source, milestone) VALUES (?, ?, ?, ?, ?)`
  );
  const info = stmt.run(timestamp, text, projectTag ?? null, source ?? "claude", milestone ? 1 : 0);
  return db
    .prepare(`SELECT * FROM entries WHERE id = ?`)
    .get(info.lastInsertRowid) as EntryRow;
}

export function flagMilestone(entryId: number): EntryRow | undefined {
  db.prepare(`UPDATE entries SET milestone = 1 WHERE id = ?`).run(entryId);
  return db.prepare(`SELECT * FROM entries WHERE id = ?`).get(entryId) as
    | EntryRow
    | undefined;
}

export function getEntriesInRange(startDate: string, endDate: string): EntryRow[] {
  return db
    .prepare(
      `SELECT * FROM entries
       WHERE date(timestamp) >= date(?) AND date(timestamp) <= date(?)
       ORDER BY timestamp DESC`
    )
    .all(startDate, endDate) as EntryRow[];
}

export function getMilestoneEntriesInRange(startDate: string, endDate: string): EntryRow[] {
  return db
    .prepare(
      `SELECT * FROM entries
       WHERE milestone = 1 AND date(timestamp) >= date(?) AND date(timestamp) <= date(?)
       ORDER BY timestamp DESC`
    )
    .all(startDate, endDate) as EntryRow[];
}

export function insertSummary(date: string, content: string): SummaryRow {
  const generatedAt = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO summaries (date, content, generated_at) VALUES (?, ?, ?)`
  );
  const info = stmt.run(date, content, generatedAt);
  return db
    .prepare(`SELECT * FROM summaries WHERE id = ?`)
    .get(info.lastInsertRowid) as SummaryRow;
}

export function getSummariesInRange(startDate: string, endDate: string): SummaryRow[] {
  return db
    .prepare(
      `SELECT * FROM summaries
       WHERE date(date) >= date(?) AND date(date) <= date(?)
       ORDER BY date DESC`
    )
    .all(startDate, endDate) as SummaryRow[];
}

export function insertDraft(
  dateRangeStart: string,
  dateRangeEnd: string,
  platform: string,
  content: string
): DraftRow {
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO drafts (date_range_start, date_range_end, platform, content, status, created_at)
     VALUES (?, ?, ?, ?, 'draft', ?)`
  );
  const info = stmt.run(dateRangeStart, dateRangeEnd, platform, content, createdAt);
  return db
    .prepare(`SELECT * FROM drafts WHERE id = ?`)
    .get(info.lastInsertRowid) as DraftRow;
}

export function listDrafts(status?: string): DraftRow[] {
  if (status) {
    return db
      .prepare(`SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC`)
      .all(status) as DraftRow[];
  }
  return db.prepare(`SELECT * FROM drafts ORDER BY created_at DESC`).all() as DraftRow[];
}

export function markDraftPosted(draftId: number): DraftRow | undefined {
  db.prepare(`UPDATE drafts SET status = 'posted' WHERE id = ?`).run(draftId);
  return db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(draftId) as
    | DraftRow
    | undefined;
}

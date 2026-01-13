import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Entry, Settings, SettingKey, EntryType, JobStage } from '@/types';

// Database path - relative to project root
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'journal.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  -- Journal entries
  CREATE TABLE IF NOT EXISTS entries (
    -- Identity
    id TEXT PRIMARY KEY,
    
    -- Timestamps (ISO 8601 UTC)
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Time context
    timezone TEXT NOT NULL DEFAULT 'UTC',
    entry_date TEXT NOT NULL,
    
    -- Entry metadata
    entry_type TEXT CHECK(entry_type IN ('brain-dump', 'daily-reflection', 'quick-note')) NOT NULL,
    title TEXT,
    
    -- Job state
    stage TEXT CHECK(stage IN (
      'pending', 'queued', 'normalizing', 'transcribing',
      'awaiting_review', 'extracting', 'awaiting_prompts',
      'generating', 'writing', 'completed', 'failed',
      'cancel_requested', 'cancelled'
    )) NOT NULL DEFAULT 'pending',
    stage_message TEXT,
    error_message TEXT,
    
    -- Job runner (recovery/locking)
    locked_by TEXT,
    locked_at TEXT,
    heartbeat_at TEXT,
    
    -- Audio (relative paths)
    original_audio_relpath TEXT,
    normalized_audio_relpath TEXT,
    audio_duration_seconds REAL,
    
    -- Content cache (Markdown is canonical after completion)
    raw_transcript TEXT,
    raw_transcript_locked_at TEXT,
    edited_transcript TEXT,
    prompt_answers TEXT,
    generated_sections TEXT,
    
    -- Output (relative path + drift detection)
    note_relpath TEXT,
    note_mtime INTEGER
  );

  -- Settings
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_entries_entry_date ON entries(entry_date);
  CREATE INDEX IF NOT EXISTS idx_entries_stage ON entries(stage);
  CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(entry_type);
  
  -- Entry links (for related entries)
  CREATE TABLE IF NOT EXISTS entry_links (
    source_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'related',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (source_id, target_id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_entry_links_source ON entry_links(source_id);
  CREATE INDEX IF NOT EXISTS idx_entry_links_target ON entry_links(target_id);
`);

// Migration: Add title column if missing (for databases created before title was added)
try {
  const tableInfo = db.prepare("PRAGMA table_info(entries)").all() as { name: string }[];
  const hasTitle = tableInfo.some(col => col.name === 'title');
  if (!hasTitle) {
    db.exec('ALTER TABLE entries ADD COLUMN title TEXT');
  }
} catch {
  // Ignore migration errors
}

// Create trigger for auto-updating updated_at
db.exec(`
  CREATE TRIGGER IF NOT EXISTS entries_updated_at 
  AFTER UPDATE ON entries
  BEGIN
    UPDATE entries SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') 
    WHERE id = NEW.id;
  END;
`);

// Full-text search table for entries
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
    id,
    raw_transcript,
    edited_transcript,
    generated_sections,
    content='entries',
    content_rowid='rowid'
  );
`);

// Triggers to keep FTS in sync
db.exec(`
  CREATE TRIGGER IF NOT EXISTS entries_fts_insert AFTER INSERT ON entries BEGIN
    INSERT INTO entries_fts(rowid, id, raw_transcript, edited_transcript, generated_sections)
    VALUES (NEW.rowid, NEW.id, NEW.raw_transcript, NEW.edited_transcript, NEW.generated_sections);
  END;
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS entries_fts_delete AFTER DELETE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, id, raw_transcript, edited_transcript, generated_sections)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.raw_transcript, OLD.edited_transcript, OLD.generated_sections);
  END;
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS entries_fts_update AFTER UPDATE ON entries BEGIN
    INSERT INTO entries_fts(entries_fts, rowid, id, raw_transcript, edited_transcript, generated_sections)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.raw_transcript, OLD.edited_transcript, OLD.generated_sections);
    INSERT INTO entries_fts(rowid, id, raw_transcript, edited_transcript, generated_sections)
    VALUES (NEW.rowid, NEW.id, NEW.raw_transcript, NEW.edited_transcript, NEW.generated_sections);
  END;
`);

// Rebuild FTS index for existing entries (runs once if needed)
try {
  const ftsCount = db.prepare('SELECT COUNT(*) as count FROM entries_fts').get() as { count: number };
  const entriesCount = db.prepare('SELECT COUNT(*) as count FROM entries').get() as { count: number };
  
  if (ftsCount.count < entriesCount.count) {
    // Rebuild FTS index
    db.exec(`
      INSERT INTO entries_fts(entries_fts) VALUES('rebuild');
    `);
  }
} catch {
  // FTS rebuild failed, ignore (may happen on first run)
}

// Insert default settings if not present
const defaultSettings: [SettingKey, string][] = [
  ['whisper_model_name', 'small'],
  ['whisper_prompt', ''],
  ['ollama_base_url', 'http://localhost:11434'],
  ['ollama_model', 'gpt-oss:20b'],
  ['keep_audio', 'true'],
  ['default_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone],
  ['user_name', ''],
  ['vad_enabled', 'false'],
  ['vad_model_path', ''],
  ['chunk_duration_seconds', '60'],
];

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);

for (const [key, value] of defaultSettings) {
  insertSetting.run(key, value);
}

// Helper to convert DB row to Entry type
function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    timezone: row.timezone as string,
    entryDate: row.entry_date as string,
    entryType: row.entry_type as EntryType,
    title: row.title as string | undefined,
    stage: row.stage as JobStage,
    stageMessage: row.stage_message as string | null,
    errorMessage: row.error_message as string | null,
    lockedBy: row.locked_by as string | null,
    lockedAt: row.locked_at as string | null,
    heartbeatAt: row.heartbeat_at as string | null,
    originalAudioRelpath: row.original_audio_relpath as string | null,
    normalizedAudioRelpath: row.normalized_audio_relpath as string | null,
    audioDurationSeconds: row.audio_duration_seconds as number | null,
    rawTranscript: row.raw_transcript as string | null,
    rawTranscriptLockedAt: row.raw_transcript_locked_at as string | null,
    editedTranscript: row.edited_transcript as string | null,
    promptAnswers: row.prompt_answers as string | null,
    generatedSections: row.generated_sections as string | null,
    noteRelpath: row.note_relpath as string | null,
    noteMtime: row.note_mtime as number | null,
  };
}

// ============================================
// Entry operations
// ============================================

export function createEntry(data: {
  id: string;
  entryType: EntryType;
  timezone: string;
  entryDate: string;
  title?: string;
}): Entry {
  const stmt = db.prepare(`
    INSERT INTO entries (id, entry_type, timezone, entry_date, title)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(data.id, data.entryType, data.timezone, data.entryDate, data.title);
  return getEntry(data.id)!;
}

export function getEntry(id: string): Entry | null {
  const stmt = db.prepare('SELECT * FROM entries WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? rowToEntry(row) : null;
}

export function getAllEntries(limit = 100, offset = 0): Entry[] {
  const stmt = db.prepare(
    'SELECT * FROM entries ORDER BY created_at DESC LIMIT ? OFFSET ?'
  );
  const rows = stmt.all(limit, offset) as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

export function getEntriesByDate(entryDate: string): Entry[] {
  const stmt = db.prepare(
    'SELECT * FROM entries WHERE entry_date = ? ORDER BY created_at DESC'
  );
  const rows = stmt.all(entryDate) as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

export function updateEntry(
  id: string,
  data: Partial<{
    entryDate: string;
    stage: JobStage;
    stageMessage: string | null;
    errorMessage: string | null;
    title: string | null;
    lockedBy: string | null;
    lockedAt: string | null;
    heartbeatAt: string | null;
    originalAudioRelpath: string | null;
    normalizedAudioRelpath: string | null;
    audioDurationSeconds: number | null;
    rawTranscript: string | null;
    rawTranscriptLockedAt: string | null;
    editedTranscript: string | null;
    promptAnswers: string | null;
    generatedSections: string | null;
    noteRelpath: string | null;
    noteMtime: number | null;
  }>
): Entry | null {
  const fields: string[] = [];
  const values: unknown[] = [];
  
  const fieldMap: Record<string, string> = {
    entryDate: 'entry_date',
    stage: 'stage',
    stageMessage: 'stage_message',
    errorMessage: 'error_message',
    title: 'title',
    lockedBy: 'locked_by',
    lockedAt: 'locked_at',
    heartbeatAt: 'heartbeat_at',
    originalAudioRelpath: 'original_audio_relpath',
    normalizedAudioRelpath: 'normalized_audio_relpath',
    audioDurationSeconds: 'audio_duration_seconds',
    rawTranscript: 'raw_transcript',
    rawTranscriptLockedAt: 'raw_transcript_locked_at',
    editedTranscript: 'edited_transcript',
    promptAnswers: 'prompt_answers',
    generatedSections: 'generated_sections',
    noteRelpath: 'note_relpath',
    noteMtime: 'note_mtime',
  };
  
  for (const [key, value] of Object.entries(data)) {
    const dbField = fieldMap[key];
    if (dbField !== undefined) {
      fields.push(`${dbField} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return getEntry(id);
  
  values.push(id);
  const stmt = db.prepare(
    `UPDATE entries SET ${fields.join(', ')} WHERE id = ?`
  );
  stmt.run(...values);
  
  return getEntry(id);
}

export function deleteEntry(id: string): boolean {
  const stmt = db.prepare('DELETE FROM entries WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Get entries stuck in processing (for recovery)
export function getStuckEntries(staleMinutes = 5): Entry[] {
  const stmt = db.prepare(`
    SELECT * FROM entries 
    WHERE stage IN ('normalizing', 'transcribing', 'generating', 'writing')
    AND heartbeat_at < datetime('now', '-' || ? || ' minutes')
  `);
  const rows = stmt.all(staleMinutes) as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

// Get entries waiting in queue
export function getQueuedEntries(): Entry[] {
  const stmt = db.prepare(
    "SELECT * FROM entries WHERE stage = 'queued' ORDER BY created_at ASC"
  );
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(rowToEntry);
}

// Search entries using full-text search
export interface SearchOptions {
  query?: string;
  entryType?: EntryType;
  stage?: JobStage | 'active' | 'done' | 'failed';
  fromDate?: string;  // YYYY-MM-DD
  toDate?: string;    // YYYY-MM-DD
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  entries: Entry[];
  total: number;
  hasMore: boolean;
}

export function searchEntries(options: SearchOptions): SearchResult {
  const { 
    query, 
    entryType, 
    stage, 
    fromDate, 
    toDate, 
    limit = 50, 
    offset = 0 
  } = options;
  
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  // Full-text search
  if (query && query.trim()) {
    // Use FTS5 match with wildcard
    const searchTerm = query.trim().split(/\s+/).map(t => `"${t}"*`).join(' ');
    conditions.push(`e.id IN (SELECT id FROM entries_fts WHERE entries_fts MATCH ?)`);
    params.push(searchTerm);
  }
  
  // Entry type filter
  if (entryType) {
    conditions.push('e.entry_type = ?');
    params.push(entryType);
  }
  
  // Stage filter
  if (stage) {
    if (stage === 'active') {
      conditions.push(`e.stage NOT IN ('completed', 'failed', 'cancelled')`);
    } else if (stage === 'done') {
      conditions.push(`e.stage = 'completed'`);
    } else if (stage === 'failed') {
      conditions.push(`e.stage IN ('failed', 'cancelled')`);
    } else {
      conditions.push('e.stage = ?');
      params.push(stage);
    }
  }
  
  // Date range filter (on entry_date)
  if (fromDate) {
    conditions.push('e.entry_date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('e.entry_date <= ?');
    params.push(toDate);
  }
  
  const whereClause = conditions.length > 0 
    ? 'WHERE ' + conditions.join(' AND ')
    : '';
  
  // Count total
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM entries e ${whereClause}`);
  const countResult = countStmt.get(...params) as { count: number };
  const total = countResult.count;
  
  // Get entries
  const selectStmt = db.prepare(`
    SELECT e.* FROM entries e 
    ${whereClause}
    ORDER BY e.created_at DESC 
    LIMIT ? OFFSET ?
  `);
  const rows = selectStmt.all(...params, limit, offset) as Record<string, unknown>[];
  
  return {
    entries: rows.map(rowToEntry),
    total,
    hasMore: offset + rows.length < total,
  };
}

// ============================================
// Settings operations
// ============================================

export function getSetting(key: SettingKey): string | null {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: SettingKey, value: string): void {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    ON CONFLICT(key) DO UPDATE SET 
      value = excluded.value,
      updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  `);
  stmt.run(key, value);
}

export function getAllSettings(): Settings {
  const stmt = db.prepare('SELECT key, value FROM settings');
  const rows = stmt.all() as { key: string; value: string }[];
  
  const settingsMap = new Map(rows.map(r => [r.key, r.value]));
  
  return {
    vaultPath: settingsMap.get('vault_path') ?? null,
    whisperModelPath: settingsMap.get('whisper_model_path') ?? null,
    whisperModelName: settingsMap.get('whisper_model_name') ?? 'small',
    whisperPrompt: settingsMap.get('whisper_prompt') ?? '',
    ollamaBaseUrl: settingsMap.get('ollama_base_url') ?? 'http://localhost:11434',
    ollamaModel: settingsMap.get('ollama_model') ?? 'gpt-oss:20b',
    keepAudio: settingsMap.get('keep_audio') !== 'false',
    defaultTimezone: settingsMap.get('default_timezone') ?? 'UTC',
    userName: settingsMap.get('user_name') ?? '',
    vadEnabled: settingsMap.get('vad_enabled') === 'true',
    vadModelPath: settingsMap.get('vad_model_path') || null,
    chunkDurationSeconds: parseInt(settingsMap.get('chunk_duration_seconds') ?? '60', 10),
  };
}

// ============================================
// Path helpers
// ============================================

/**
 * Get the audio directory inside the vault: {vaultPath}/journal/audio/
 * Creates the directory if it doesn't exist.
 */
export function getAudioDir(vaultPath: string): string {
  const audioDir = path.join(vaultPath, 'journal', 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  return audioDir;
}

/**
 * Resolve a relative audio path to absolute path within the vault
 */
export function resolveAudioPath(relpath: string, vaultPath: string): string {
  return path.join(vaultPath, relpath);
}

/**
 * Get relative path for audio file within vault (for storing in DB and linking in markdown)
 * Returns: journal/audio/{filename}
 */
export function getAudioRelpath(filename: string): string {
  return path.join('journal', 'audio', filename);
}

/**
 * Get the journal notes directory: {vaultPath}/journal/
 * Creates the directory if it doesn't exist.
 */
export function getJournalDir(vaultPath: string): string {
  const journalDir = path.join(vaultPath, 'journal');
  if (!fs.existsSync(journalDir)) {
    fs.mkdirSync(journalDir, { recursive: true });
  }
  return journalDir;
}

/**
 * Resolve a relative note path to absolute path within the vault
 */
export function resolveNotePath(relpath: string, vaultPath: string): string {
  return path.join(vaultPath, relpath);
}

// ============================================
// Entry links (related entries)
// ============================================

export type LinkType = 'related' | 'followup' | 'reference';

export interface EntryLink {
  sourceId: string;
  targetId: string;
  linkType: LinkType;
  createdAt: string;
}

export function addEntryLink(sourceId: string, targetId: string, linkType: LinkType = 'related'): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO entry_links (source_id, target_id, link_type)
    VALUES (?, ?, ?)
  `);
  stmt.run(sourceId, targetId, linkType);
}

export function removeEntryLink(sourceId: string, targetId: string): void {
  const stmt = db.prepare('DELETE FROM entry_links WHERE source_id = ? AND target_id = ?');
  stmt.run(sourceId, targetId);
}

export function getEntryLinks(entryId: string): { linked: Entry[]; linkedBy: Entry[] } {
  // Get entries this entry links to
  const linkedStmt = db.prepare(`
    SELECT e.* FROM entries e
    JOIN entry_links l ON l.target_id = e.id
    WHERE l.source_id = ?
    ORDER BY e.created_at DESC
  `);
  const linkedRows = linkedStmt.all(entryId) as Record<string, unknown>[];
  
  // Get entries that link to this entry
  const linkedByStmt = db.prepare(`
    SELECT e.* FROM entries e
    JOIN entry_links l ON l.source_id = e.id
    WHERE l.target_id = ?
    ORDER BY e.created_at DESC
  `);
  const linkedByRows = linkedByStmt.all(entryId) as Record<string, unknown>[];
  
  return {
    linked: linkedRows.map(rowToEntry),
    linkedBy: linkedByRows.map(rowToEntry),
  };
}

export function getAllLinksForEntry(entryId: string): EntryLink[] {
  const stmt = db.prepare(`
    SELECT source_id, target_id, link_type, created_at 
    FROM entry_links 
    WHERE source_id = ? OR target_id = ?
  `);
  const rows = stmt.all(entryId, entryId) as Array<{
    source_id: string;
    target_id: string;
    link_type: string;
    created_at: string;
  }>;
  
  return rows.map(row => ({
    sourceId: row.source_id,
    targetId: row.target_id,
    linkType: row.link_type as LinkType,
    createdAt: row.created_at,
  }));
}

// Export database instance for advanced queries
export { db };

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
`);

// Create trigger for auto-updating updated_at
db.exec(`
  CREATE TRIGGER IF NOT EXISTS entries_updated_at 
  AFTER UPDATE ON entries
  BEGIN
    UPDATE entries SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') 
    WHERE id = NEW.id;
  END;
`);

// Insert default settings if not present
const defaultSettings: [SettingKey, string][] = [
  ['whisper_model_name', 'small'],
  ['ollama_base_url', 'http://localhost:11434'],
  ['ollama_model', 'gpt-oss:20b'],
  ['keep_audio', 'true'],
  ['default_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone],
  ['user_name', ''],
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
}): Entry {
  const stmt = db.prepare(`
    INSERT INTO entries (id, entry_type, timezone, entry_date)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(data.id, data.entryType, data.timezone, data.entryDate);
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
    stage: JobStage;
    stageMessage: string | null;
    errorMessage: string | null;
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
    stage: 'stage',
    stageMessage: 'stage_message',
    errorMessage: 'error_message',
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
    ollamaBaseUrl: settingsMap.get('ollama_base_url') ?? 'http://localhost:11434',
    ollamaModel: settingsMap.get('ollama_model') ?? 'gpt-oss:20b',
    keepAudio: settingsMap.get('keep_audio') !== 'false',
    defaultTimezone: settingsMap.get('default_timezone') ?? 'UTC',
    userName: settingsMap.get('user_name') ?? '',
  };
}

// ============================================
// Audio directory helpers
// ============================================

export function getAudioDir(): string {
  const audioDir = path.join(DATA_DIR, 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  return audioDir;
}

export function resolveAudioPath(relpath: string): string {
  return path.join(getAudioDir(), relpath);
}

export function resolveNotePath(relpath: string, vaultPath: string): string {
  return path.join(vaultPath, relpath);
}

// Export database instance for advanced queries
export { db };

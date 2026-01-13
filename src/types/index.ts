// Entry types
export type EntryType = 'brain-dump' | 'daily-reflection' | 'quick-note';

// Job stages
export type JobStage =
  | 'pending'
  | 'queued'
  | 'normalizing'
  | 'transcribing'
  | 'awaiting_review'
  | 'awaiting_prompts'
  | 'generating'
  | 'writing'
  | 'completed'
  | 'failed'
  | 'cancel_requested'
  | 'cancelled';

// Prompt answer structure (stable schema for future embedding)
export interface PromptAnswer {
  text: string;
  extractedText?: string;
  audioRelpath?: string;
  audioTranscript?: string;
}

// All prompt fields are optional - users can skip
export type PromptAnswers = Partial<{
  gratitude: PromptAnswer;
  accomplishments: PromptAnswer;
  challenges: PromptAnswer;
  tomorrow: PromptAnswer;
}>;

// Generated sections (keyed by section name)
export interface GeneratedSections {
  JOURNAL?: string;
  AI_REFLECTION?: string;
  SUMMARY?: string;
  RELATED?: string;
}

// Database entry row
export interface Entry {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  timezone: string;
  entryDate: string;
  entryType: EntryType;
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
  promptAnswers: string | null; // JSON string
  generatedSections: string | null; // JSON string
  noteRelpath: string | null;
  noteMtime: number | null;
}

// Entry with parsed JSON fields
export interface EntryWithContent extends Omit<Entry, 'promptAnswers' | 'generatedSections'> {
  promptAnswers: PromptAnswers;
  generatedSections: GeneratedSections;
}

// API response for entry (includes computed fields)
export interface EntryResponse extends Entry {
  overallProgress: number;
  hasExternalEdits?: boolean;
  noteContent?: string | null;
}

// Settings keys
export type SettingKey =
  | 'vault_path'
  | 'whisper_model_path'
  | 'whisper_model_name'
  | 'whisper_prompt'
  | 'ollama_base_url'
  | 'ollama_model'
  | 'keep_audio'
  | 'default_timezone'
  | 'user_name'
  | 'vad_enabled'
  | 'vad_model_path'
  | 'chunk_duration_seconds';

export interface Settings {
  vaultPath: string | null;
  whisperModelPath: string | null;
  whisperModelName: string;
  whisperPrompt: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  keepAudio: boolean;
  defaultTimezone: string;
  userName: string;
  vadEnabled: boolean;
  vadModelPath: string | null;
  chunkDurationSeconds: number;
}

// Markdown parsing
export interface ParsedSection {
  name: string;
  content: string;
  flags: string[];
  startIndex: number;
  endIndex: number;
  startLine: number;
  endLine: number;
}

export interface ParseError {
  type: 'missing_end' | 'missing_start' | 'invalid_nesting' | 'duplicate_section';
  section?: string;
  line?: number;
  message: string;
}

export interface ParseResult {
  sections: ParsedSection[];
  errors: ParseError[];
}

// Markdown frontmatter
export interface NoteFrontmatter {
  id: string;
  created: string;
  createdLocal: string;
  timezone: string;
  entryDate: string;
  type: EntryType;
  audioDuration?: number;
  audioFile?: string;
  tags: string[];
}

// Prerequisites check
export interface PrerequisiteStatus {
  name: string;
  installed: boolean;
  version?: string;
  error?: string;
  installCommand?: string;
}

export interface PrerequisitesCheck {
  ffmpeg: PrerequisiteStatus;
  whisper: PrerequisiteStatus;
  ollama: PrerequisiteStatus;
  allReady: boolean;
}

// Stage weights for progress calculation
export const STAGE_WEIGHTS: Record<JobStage, { start: number; end: number }> = {
  pending: { start: 0, end: 0 },
  queued: { start: 0, end: 5 },
  normalizing: { start: 5, end: 15 },
  transcribing: { start: 15, end: 60 },
  awaiting_review: { start: 60, end: 60 },
  awaiting_prompts: { start: 60, end: 60 },
  generating: { start: 60, end: 90 },
  writing: { start: 90, end: 100 },
  completed: { start: 100, end: 100 },
  failed: { start: 0, end: 0 },
  cancel_requested: { start: 0, end: 0 },
  cancelled: { start: 0, end: 0 },
};

// Calculate overall progress from stage
export function calculateOverallProgress(stage: JobStage): number {
  const weight = STAGE_WEIGHTS[stage];
  return weight ? weight.start : 0;
}

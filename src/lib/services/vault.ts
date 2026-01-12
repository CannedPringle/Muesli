import fs from 'fs/promises';
import path from 'path';
import { formatInTimeZone } from 'date-fns-tz';
import { getAllSettings, resolveNotePath, getJournalDir } from '@/lib/db';
import { createSection, replaceSection, parseSectionsStrict, getSection, type SectionName } from '@/lib/markdown';
import type { Entry, PromptAnswers, GeneratedSections, NoteFrontmatter } from '@/types';

/**
 * Generate filename for a journal entry
 * Format: YYYY-MM-DD-HHmmss-{type}.md
 */
export function generateFilename(entry: Entry): string {
  const date = new Date(entry.createdAt);
  const dateStr = formatInTimeZone(date, entry.timezone, 'yyyy-MM-dd');
  const timeStr = formatInTimeZone(date, entry.timezone, 'HHmmss');
  
  return `${dateStr}-${timeStr}-${entry.entryType}.md`;
}

/**
 * Generate relative path for note within vault
 * Returns: journal/{filename}
 */
export function generateNoteRelpath(entry: Entry): string {
  return path.join('journal', generateFilename(entry));
}

/**
 * Generate YAML frontmatter for a note
 */
function generateFrontmatter(entry: Entry): string {
  const date = new Date(entry.createdAt);
  const createdUtc = entry.createdAt;
  const createdLocal = formatInTimeZone(date, entry.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  
  const frontmatter: NoteFrontmatter = {
    id: entry.id,
    created: createdUtc,
    createdLocal,
    timezone: entry.timezone,
    entryDate: entry.entryDate,
    type: entry.entryType,
    tags: ['journal', entry.entryType],
  };
  
  if (entry.audioDurationSeconds) {
    frontmatter.audioDuration = Math.round(entry.audioDurationSeconds);
  }
  
  // Add audio file reference if available
  if (entry.originalAudioRelpath) {
    frontmatter.audioFile = entry.originalAudioRelpath;
  }
  
  const lines = ['---'];
  lines.push(`id: ${frontmatter.id}`);
  lines.push(`created: ${frontmatter.created}`);
  lines.push(`created_local: ${frontmatter.createdLocal}`);
  lines.push(`timezone: ${frontmatter.timezone}`);
  lines.push(`entry_date: ${frontmatter.entryDate}`);
  lines.push(`type: ${frontmatter.type}`);
  if (frontmatter.audioDuration) {
    lines.push(`audio_duration: ${frontmatter.audioDuration}`);
  }
  if (frontmatter.audioFile) {
    lines.push(`audio_file: ${frontmatter.audioFile}`);
  }
  lines.push(`tags: [${frontmatter.tags.join(', ')}]`);
  lines.push('---');
  
  return lines.join('\n');
}

/**
 * Generate title based on entry type
 */
function generateTitle(entry: Entry): string {
  const date = new Date(entry.createdAt);
  const dateFormatted = formatInTimeZone(date, entry.timezone, 'MMMM d, yyyy');
  const timeFormatted = formatInTimeZone(date, entry.timezone, 'h:mm a');
  
  switch (entry.entryType) {
    case 'brain-dump':
      return `Brain Dump - ${dateFormatted}`;
    case 'daily-reflection':
      return `Daily Reflection - ${dateFormatted}`;
    case 'quick-note':
      return `Quick Note - ${timeFormatted}`;
    default:
      return `Journal - ${dateFormatted}`;
  }
}

/**
 * Generate audio section with both Obsidian embed and markdown link
 * Audio path is relative from the note's location (journal/) to audio (journal/audio/)
 */
function generateAudioSection(entry: Entry): string | null {
  if (!entry.originalAudioRelpath) {
    return null;
  }
  
  // Get just the filename from the full relpath (journal/audio/filename.ext -> filename.ext)
  const audioFilename = path.basename(entry.originalAudioRelpath);
  // Relative path from journal/ to journal/audio/
  const relativeAudioPath = `audio/${audioFilename}`;
  
  const content = `## Audio

[Audio Recording](${relativeAudioPath}) | ![[${relativeAudioPath}]]`;
  
  return content;
}

/**
 * Generate complete markdown content for a note
 */
export function generateNoteContent(
  entry: Entry,
  transcript: string,
  promptAnswers: PromptAnswers,
  generatedSections: GeneratedSections
): string {
  const sections: string[] = [];
  
  // Frontmatter
  sections.push(generateFrontmatter(entry));
  
  // Title and tags
  sections.push('');
  sections.push(`# ${generateTitle(entry)}`);
  sections.push('');
  sections.push(`#journal #${entry.entryType}`);
  sections.push('');
  
  // Audio section (if audio exists)
  const audioSection = generateAudioSection(entry);
  if (audioSection) {
    sections.push(createSection('AUDIO', audioSection, ['immutable']));
    sections.push('');
  }
  
  // Entry-type specific content
  if (entry.entryType === 'brain-dump') {
    // Brain-dump: JOURNAL section (AI-generated Daily Strategic Journal)
    if (generatedSections.JOURNAL) {
      sections.push(createSection('JOURNAL', generatedSections.JOURNAL, ['generated']));
      sections.push('');
    }
  } else if (entry.entryType === 'daily-reflection') {
    // Daily-reflection: keep existing format with prompt answers + AI reflection
    if (promptAnswers.gratitude?.text) {
      sections.push(createSection('GRATITUDE', `## Gratitude\n\n${promptAnswers.gratitude.text}`));
      sections.push('');
    }
    
    if (promptAnswers.accomplishments?.text) {
      sections.push(createSection('ACCOMPLISHMENTS', `## Accomplishments\n\n${promptAnswers.accomplishments.text}`));
      sections.push('');
    }
    
    if (promptAnswers.challenges?.text) {
      sections.push(createSection('CHALLENGES', `## Challenges & Lessons\n\n${promptAnswers.challenges.text}`));
      sections.push('');
    }
    
    if (promptAnswers.tomorrow?.text) {
      sections.push(createSection('TOMORROW', `## Tomorrow\'s Focus\n\n${promptAnswers.tomorrow.text}`));
      sections.push('');
    }
    
    // AI Reflection section (generated)
    if (generatedSections.AI_REFLECTION) {
      sections.push(createSection('AI_REFLECTION', `## Reflection\n\n${generatedSections.AI_REFLECTION}`, ['generated']));
      sections.push('');
    }
  }
  // Quick-note: no AI content, just transcript below
  
  // Transcript section (immutable, collapsed for brain-dump and daily-reflection)
  if (entry.entryType === 'quick-note') {
    // Quick-note: transcript is the main content, not collapsed
    sections.push(createSection('TRANSCRIPT', `## Transcript\n\n${transcript}`, ['immutable']));
  } else {
    // Brain-dump and daily-reflection: collapsed transcript
    const collapsedTranscript = `<details>
<summary>Raw Transcript</summary>

${transcript}

</details>`;
    sections.push(createSection('TRANSCRIPT', collapsedTranscript, ['immutable']));
  }
  sections.push('');
  
  // Related entries section (placeholder for future)
  sections.push(createSection('RELATED', '## Related Entries\n', ['generated']));
  
  return sections.join('\n');
}

/**
 * Write note to vault with atomic write (temp file → rename)
 * Notes are saved to {vaultPath}/journal/
 */
export async function writeNote(
  entry: Entry,
  transcript: string,
  promptAnswers: PromptAnswers,
  generatedSections: GeneratedSections
): Promise<{ relpath: string; fullPath: string; mtime: number }> {
  const settings = getAllSettings();
  
  if (!settings.vaultPath) {
    throw new Error('Vault path not configured. Please set it in settings.');
  }
  
  // Ensure vault directory exists
  try {
    await fs.access(settings.vaultPath);
  } catch {
    throw new Error(`Vault path does not exist: ${settings.vaultPath}`);
  }
  
  // Ensure journal directory exists
  getJournalDir(settings.vaultPath);
  
  const relpath = generateNoteRelpath(entry);
  const fullPath = resolveNotePath(relpath, settings.vaultPath);
  const tempPath = `${fullPath}.tmp.${Date.now()}`;
  
  // Generate content
  const content = generateNoteContent(entry, transcript, promptAnswers, generatedSections);
  
  try {
    // Write to temp file first
    await fs.writeFile(tempPath, content, 'utf-8');
    
    // Atomic rename
    await fs.rename(tempPath, fullPath);
    
    // Get mtime for drift detection
    const stat = await fs.stat(fullPath);
    
    return {
      relpath,
      fullPath,
      mtime: stat.mtimeMs,
    };
  } catch (err) {
    // Clean up temp file on failure
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

/**
 * Update a specific section in an existing note
 * Uses atomic write pattern
 */
export async function updateNoteSection(
  notePath: string,
  sectionName: SectionName,
  newContent: string
): Promise<{ mtime: number }> {
  const tempPath = `${notePath}.tmp.${Date.now()}`;
  
  // Read existing file
  const existing = await fs.readFile(notePath, 'utf-8');
  
  // Validate structure first
  parseSectionsStrict(existing);
  
  // Replace only the targeted section
  const updated = replaceSection(existing, sectionName, newContent);
  
  try {
    // Write to temp file
    await fs.writeFile(tempPath, updated, 'utf-8');
    
    // Atomic rename
    await fs.rename(tempPath, notePath);
    
    // Get new mtime
    const stat = await fs.stat(notePath);
    
    return { mtime: stat.mtimeMs };
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

/**
 * Check if a note has been modified externally (e.g., in Obsidian)
 */
export async function hasExternalEdits(entry: Entry): Promise<boolean> {
  if (!entry.noteRelpath || !entry.noteMtime) {
    return false;
  }
  
  const settings = getAllSettings();
  if (!settings.vaultPath) {
    return false;
  }
  
  const fullPath = resolveNotePath(entry.noteRelpath, settings.vaultPath);
  
  try {
    const stat = await fs.stat(fullPath);
    return stat.mtimeMs > entry.noteMtime;
  } catch {
    // File doesn't exist or can't be accessed
    return false;
  }
}

/**
 * Read note content from vault
 */
export async function readNote(entry: Entry): Promise<string | null> {
  if (!entry.noteRelpath) {
    return null;
  }
  
  const settings = getAllSettings();
  if (!settings.vaultPath) {
    return null;
  }
  
  const fullPath = resolveNotePath(entry.noteRelpath, settings.vaultPath);
  
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Open note in Obsidian using URI scheme
 */
export function getObsidianUri(vaultPath: string, noteRelpath: string): string {
  const vaultName = path.basename(vaultPath);
  const encodedVault = encodeURIComponent(vaultName);
  const encodedFile = encodeURIComponent(noteRelpath);
  
  return `obsidian://open?vault=${encodedVault}&file=${encodedFile}`;
}

/**
 * Get reveal in Finder command
 */
export function getRevealCommand(fullPath: string): string {
  return `open -R "${fullPath}"`;
}

/**
 * Section header templates for rebuilding content
 * Maps section name to header format
 */
const SECTION_HEADERS: Record<string, string> = {
  JOURNAL: '## User – Daily Strategic Journal',
  TRANSCRIPT: '', // Special handling - uses <details> wrapper
  GRATITUDE: '## Gratitude',
  ACCOMPLISHMENTS: '## Accomplishments',
  CHALLENGES: '## Challenges & Lessons',
  TOMORROW: "## Tomorrow's Focus",
  AI_REFLECTION: '## Reflection',
};

/**
 * Update content of multiple sections in an existing note.
 * Preserves section markers and structure.
 * Uses atomic write pattern.
 * 
 * @param entry - The entry whose note to update
 * @param editedSections - Map of section name to new content (without headers)
 * @returns Object with new mtime for drift detection
 */
export async function updateNoteContent(
  entry: Entry,
  editedSections: Record<string, string>
): Promise<{ mtime: number }> {
  if (!entry.noteRelpath) {
    throw new Error('Entry has no note file');
  }
  
  const settings = getAllSettings();
  if (!settings.vaultPath) {
    throw new Error('Vault path not configured');
  }
  
  const fullPath = resolveNotePath(entry.noteRelpath, settings.vaultPath);
  const tempPath = `${fullPath}.tmp.${Date.now()}`;
  
  // Read existing file
  let content: string;
  try {
    content = await fs.readFile(fullPath, 'utf-8');
  } catch {
    throw new Error(`Note file not found: ${entry.noteRelpath}`);
  }
  
  // Validate structure before editing
  parseSectionsStrict(content);
  
  // Update each section
  for (const [sectionName, newContent] of Object.entries(editedSections)) {
    // Skip non-existent sections
    const section = getSection(content, sectionName as SectionName);
    if (!section) {
      console.warn(`Section ${sectionName} not found in note, skipping`);
      continue;
    }
    
    // Build the full section content with header
    let fullContent: string;
    
    if (sectionName === 'TRANSCRIPT') {
      // Transcript uses <details> wrapper (for brain-dump and daily-reflection)
      // Check if original had details wrapper
      const hasDetails = section.content.includes('<details>');
      if (hasDetails) {
        fullContent = `<details>
<summary>Raw Transcript</summary>

${newContent}

</details>`;
      } else {
        // Quick-note style - plain transcript with header
        fullContent = `## Transcript\n\n${newContent}`;
      }
    } else {
      // Regular section with header
      const header = SECTION_HEADERS[sectionName];
      if (header) {
        fullContent = `${header}\n\n${newContent}`;
      } else {
        // Unknown section, just use the content as-is
        fullContent = newContent;
      }
    }
    
    // Replace the section content
    content = replaceSection(content, sectionName as SectionName, fullContent);
  }
  
  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8');
    
    // Atomic rename
    await fs.rename(tempPath, fullPath);
    
    // Get new mtime
    const stat = await fs.stat(fullPath);
    
    return { mtime: stat.mtimeMs };
  } catch (err) {
    // Clean up temp file on failure
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

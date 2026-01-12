/**
 * Parse vault markdown note content into structured sections for rendering.
 * 
 * Handles:
 * - YAML frontmatter extraction
 * - Section marker stripping
 * - Obsidian-specific syntax cleaning
 */

export interface ParsedNoteSection {
  name: string;       // e.g., 'JOURNAL', 'TRANSCRIPT', 'AUDIO'
  content: string;    // Clean markdown content (markers removed)
  flags: string[];    // e.g., ['immutable'], ['generated']
}

export interface ParsedNoteFrontmatter {
  id?: string;
  created?: string;
  createdLocal?: string;
  timezone?: string;
  entryDate?: string;
  type?: string;
  audioDuration?: number;
  audioFile?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ParsedNote {
  frontmatter: ParsedNoteFrontmatter | null;
  title: string | null;
  sections: ParsedNoteSection[];
}

// Regex patterns
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;
const TITLE_REGEX = /^#\s+(.+)$/m;
const HASHTAG_LINE_REGEX = /^#\w+(?:\s+#\w+)*\s*$/m;
const SECTION_START_REGEX = /<!-- WHISPER_JOURNAL:([A-Z][A-Z0-9_]*):START(?:\s+([\w\s]+))? -->/;
const SECTION_END_REGEX = /<!-- WHISPER_JOURNAL:([A-Z][A-Z0-9_]*):END -->/;
const OBSIDIAN_EMBED_REGEX = /!\[\[([^\]]+)\]\]/g;

/**
 * Parse YAML frontmatter into an object
 */
function parseFrontmatter(yaml: string): ParsedNoteFrontmatter {
  const result: ParsedNoteFrontmatter = {};
  
  const lines = yaml.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();
    
    // Handle arrays like [journal, brain-dump]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim());
    }
    // Handle numbers
    else if (typeof value === 'string' && /^\d+$/.test(value)) {
      value = parseInt(value, 10);
    }
    
    // Convert snake_case to camelCase for common fields
    const keyMap: Record<string, string> = {
      'created_local': 'createdLocal',
      'entry_date': 'entryDate',
      'audio_duration': 'audioDuration',
      'audio_file': 'audioFile',
    };
    
    const mappedKey = keyMap[key] || key;
    result[mappedKey] = value;
  }
  
  return result;
}

/**
 * Clean content by removing Obsidian-specific syntax
 */
function cleanObsidianSyntax(content: string): string {
  // Remove Obsidian embeds like ![[audio/file.wav]]
  // Keep regular markdown links [text](url)
  return content.replace(OBSIDIAN_EMBED_REGEX, '');
}

/**
 * Parse all sections from markdown content
 */
function parseSections(markdown: string): ParsedNoteSection[] {
  const sections: ParsedNoteSection[] = [];
  const lines = markdown.split('\n');
  
  let currentSection: { name: string; flags: string[]; contentLines: string[] } | null = null;
  
  for (const line of lines) {
    // Check for section start
    const startMatch = line.match(SECTION_START_REGEX);
    if (startMatch) {
      // Save previous section if any
      if (currentSection) {
        sections.push({
          name: currentSection.name,
          content: cleanObsidianSyntax(currentSection.contentLines.join('\n').trim()),
          flags: currentSection.flags,
        });
      }
      
      const name = startMatch[1];
      const flagsStr = startMatch[2] || '';
      const flags = flagsStr.split(/\s+/).filter(Boolean);
      
      currentSection = { name, flags, contentLines: [] };
      continue;
    }
    
    // Check for section end
    const endMatch = line.match(SECTION_END_REGEX);
    if (endMatch && currentSection && endMatch[1] === currentSection.name) {
      sections.push({
        name: currentSection.name,
        content: cleanObsidianSyntax(currentSection.contentLines.join('\n').trim()),
        flags: currentSection.flags,
      });
      currentSection = null;
      continue;
    }
    
    // Add line to current section
    if (currentSection) {
      currentSection.contentLines.push(line);
    }
  }
  
  // Handle unclosed section (shouldn't happen with valid notes)
  if (currentSection) {
    sections.push({
      name: currentSection.name,
      content: cleanObsidianSyntax(currentSection.contentLines.join('\n').trim()),
      flags: currentSection.flags,
    });
  }
  
  return sections;
}

/**
 * Parse vault markdown note content into structured sections.
 * 
 * @param markdown - Raw markdown content from vault
 * @returns ParsedNote with frontmatter, title, and sections
 */
export function parseNoteContent(markdown: string): ParsedNote {
  let content = markdown;
  let frontmatter: ParsedNoteFrontmatter | null = null;
  let title: string | null = null;
  
  // Extract frontmatter
  const frontmatterMatch = content.match(FRONTMATTER_REGEX);
  if (frontmatterMatch) {
    frontmatter = parseFrontmatter(frontmatterMatch[1]);
    content = content.slice(frontmatterMatch[0].length);
  }
  
  // Extract title (first # heading)
  const titleMatch = content.match(TITLE_REGEX);
  if (titleMatch) {
    title = titleMatch[1].trim();
    // Remove the title line from content (we'll render it separately)
    content = content.replace(TITLE_REGEX, '');
  }
  
  // Remove hashtag line (#journal #brain-dump)
  content = content.replace(HASHTAG_LINE_REGEX, '');
  
  // Parse sections
  const sections = parseSections(content);
  
  return {
    frontmatter,
    title,
    sections,
  };
}

/**
 * Get the content of a specific section by name
 */
export function getSectionContent(parsedNote: ParsedNote, sectionName: string): string | null {
  const section = parsedNote.sections.find(s => s.name === sectionName);
  return section?.content ?? null;
}

/**
 * Check if a section has a specific flag
 */
export function sectionHasFlag(section: ParsedNoteSection, flag: string): boolean {
  return section.flags.includes(flag);
}

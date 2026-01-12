import type { ParsedSection, ParseError, ParseResult } from '@/types';

// Marker format: <!-- WHISPER_JOURNAL:SECTION_NAME:START [flags] -->
const MARKER_START_REGEX = /<!-- WHISPER_JOURNAL:([A-Z][A-Z0-9_]*):START(?:\s+([\w\s]+))? -->/g;
const MARKER_END_REGEX = /<!-- WHISPER_JOURNAL:([A-Z][A-Z0-9_]*):END -->/g;

// Valid section names
export const SECTION_NAMES = [
  'TRANSCRIPT',
  'JOURNAL',
  'GRATITUDE',
  'ACCOMPLISHMENTS',
  'CHALLENGES',
  'TOMORROW',
  'AI_REFLECTION',
  'SUMMARY',
  'RELATED',
] as const;

export type SectionName = typeof SECTION_NAMES[number];

/**
 * Parse all sections from markdown content
 * Returns sections and any errors found
 */
export function parseSections(markdown: string): ParseResult {
  const sections: ParsedSection[] = [];
  const errors: ParseError[] = [];
  const openSections: Map<string, { 
    startIndex: number; 
    startLine: number; 
    flags: string[];
    contentStart: number;
  }> = new Map();
  
  const lines = markdown.split('\n');
  let charIndex = 0;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    
    // Check for START marker
    const startMatch = line.match(/<!-- WHISPER_JOURNAL:([A-Z][A-Z0-9_]*):START(?:\s+([\w\s]+))? -->/);
    if (startMatch) {
      const name = startMatch[1];
      const flagsStr = startMatch[2] || '';
      const flags = flagsStr.split(/\s+/).filter(Boolean);
      
      if (openSections.has(name)) {
        errors.push({
          type: 'invalid_nesting',
          section: name,
          line: lineNum + 1,
          message: `Section ${name} opened at line ${openSections.get(name)!.startLine} but opened again at line ${lineNum + 1}`
        });
      } else {
        openSections.set(name, { 
          startIndex: charIndex, 
          startLine: lineNum + 1,
          flags,
          contentStart: charIndex + line.length + 1, // After the newline
        });
      }
    }
    
    // Check for END marker
    const endMatch = line.match(/<!-- WHISPER_JOURNAL:([A-Z][A-Z0-9_]*):END -->/);
    if (endMatch) {
      const name = endMatch[1];
      
      if (!openSections.has(name)) {
        errors.push({
          type: 'missing_start',
          section: name,
          line: lineNum + 1,
          message: `END marker for ${name} at line ${lineNum + 1} without matching START`
        });
      } else {
        const start = openSections.get(name)!;
        const content = markdown.slice(start.contentStart, charIndex).trim();
        
        sections.push({
          name,
          content,
          flags: start.flags,
          startIndex: start.startIndex,
          endIndex: charIndex + line.length,
          startLine: start.startLine,
          endLine: lineNum + 1,
        });
        
        openSections.delete(name);
      }
    }
    
    charIndex += line.length + 1; // +1 for newline
  }
  
  // Check for unclosed sections
  for (const [name, { startLine }] of openSections) {
    errors.push({
      type: 'missing_end',
      section: name,
      line: startLine,
      message: `Section ${name} opened at line ${startLine} but never closed`
    });
  }
  
  return { sections, errors };
}

/**
 * Parse sections with strict validation - throws on any error
 */
export function parseSectionsStrict(markdown: string): ParsedSection[] {
  const { sections, errors } = parseSections(markdown);
  
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.message}`).join('\n');
    throw new MarkdownCorruptionError(
      `Markdown structure corrupted:\n${errorMessages}`,
      errors
    );
  }
  
  return sections;
}

/**
 * Get a specific section by name
 */
export function getSection(markdown: string, name: SectionName): ParsedSection | null {
  const { sections } = parseSections(markdown);
  return sections.find(s => s.name === name) || null;
}

/**
 * Replace content within a section (between markers)
 * Preserves everything outside the markers
 */
export function replaceSection(
  markdown: string, 
  sectionName: SectionName, 
  newContent: string
): string {
  const startMarkerRegex = new RegExp(
    `<!-- WHISPER_JOURNAL:${sectionName}:START(?:\\s+[\\w\\s]+)? -->`
  );
  const endMarker = `<!-- WHISPER_JOURNAL:${sectionName}:END -->`;
  
  const startMatch = markdown.match(startMarkerRegex);
  if (!startMatch) {
    throw new Error(`Section ${sectionName} START marker not found`);
  }
  
  const startIdx = markdown.indexOf(startMatch[0]);
  const endIdx = markdown.indexOf(endMarker);
  
  if (endIdx === -1) {
    throw new Error(`Section ${sectionName} END marker not found`);
  }
  
  if (endIdx < startIdx) {
    throw new Error(`Section ${sectionName} markers are in wrong order`);
  }
  
  // Preserve everything before start marker (including the marker itself)
  const before = markdown.slice(0, startIdx + startMatch[0].length);
  // Preserve everything from end marker onwards
  const after = markdown.slice(endIdx);
  
  return `${before}\n${newContent}\n${after}`;
}

/**
 * Create a section with markers
 */
export function createSection(name: SectionName, content: string, flags: string[] = []): string {
  const flagsStr = flags.length > 0 ? ` ${flags.join(' ')}` : '';
  return `<!-- WHISPER_JOURNAL:${name}:START${flagsStr} -->\n${content}\n<!-- WHISPER_JOURNAL:${name}:END -->`;
}

/**
 * Check if a section has a specific flag
 */
export function sectionHasFlag(section: ParsedSection, flag: string): boolean {
  return section.flags.includes(flag);
}

/**
 * Custom error for markdown corruption
 */
export class MarkdownCorruptionError extends Error {
  constructor(message: string, public errors: ParseError[]) {
    super(message);
    this.name = 'MarkdownCorruptionError';
  }
}

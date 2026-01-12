'use client';

import { useMemo, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { parseNoteContent, type ParsedNoteSection } from '@/lib/note-parser';

// ============================================================================
// Types
// ============================================================================

interface NoteViewerProps {
  noteContent: string;
  audioRelpath?: string | null;
  isEditing?: boolean;
  editedSections?: Record<string, string>;
  onSectionChange?: (sectionName: string, content: string) => void;
}

interface NoteSectionProps {
  section: ParsedNoteSection;
  isEditing?: boolean;
  editedContent?: string;
  onContentChange?: (content: string) => void;
}

interface ContentBlock {
  type: 'markdown' | 'transcript' | 'tldr';
  content: string;
  label?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Sections to skip (we handle these separately or not at all)
const SKIP_SECTIONS = ['RELATED', 'AUDIO'];

// Sections that cannot be edited
const NON_EDITABLE_SECTIONS = ['RELATED', 'AUDIO'];

// Human-readable labels for section names
const SECTION_LABELS: Record<string, string> = {
  JOURNAL: 'Journal',
  TRANSCRIPT: 'Transcript',
  GRATITUDE: 'Gratitude',
  ACCOMPLISHMENTS: 'Accomplishments',
  CHALLENGES: 'Challenges & Lessons',
  TOMORROW: "Tomorrow's Focus",
  AI_REFLECTION: 'Reflection',
};

// Premium typography prose classes (Bear/Craft/Reflect inspired)
const PROSE_CLASSES = cn(
  // Base typography
  'prose prose-stone dark:prose-invert max-w-none',
  
  // Paragraph rhythm - comfortable reading
  'prose-p:leading-[1.75]',
  'prose-p:text-stone-700 dark:prose-p:text-stone-300',
  'prose-p:my-4',
  
  // Headings: crisp, editorial hierarchy
  'prose-headings:tracking-tight',
  'prose-headings:text-stone-950 dark:prose-headings:text-stone-50',
  
  // HR: Breathing room
  'prose-hr:my-8 prose-hr:border-stone-200/60 dark:prose-hr:border-stone-700/60',
  
  // Lists: tight and scannable
  'prose-ul:my-4 prose-ol:my-4',
  'prose-li:my-1',
  'prose-ul:pl-5 prose-ol:pl-5',
  
  // Strong text emphasis
  'prose-strong:text-stone-900 dark:prose-strong:text-stone-100',
  'prose-strong:font-semibold',
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate slug from heading text (for scroll-to-section)
 */
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Pre-process markdown content for premium rendering:
 * - Strip HTML comments (including WHISPER_JOURNAL markers)
 * - Convert <details>/<summary> to custom :::transcript tokens
 * - Wrap TL;DR sections in :::tldr tokens
 * - Clean up excessive whitespace
 */
function sanitizeForRender(content: string): string {
  let result = content;
  
  // 1. Strip all HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  
  // 2. Convert <details><summary>Label</summary>..content..</details>
  //    to: :::transcript[Label]\n..content..\n:::
  result = result.replace(
    /<details>\s*<summary>([^<]*)<\/summary>\s*([\s\S]*?)\s*<\/details>/gi,
    (_, label, body) => `:::transcript[${label.trim()}]\n${body.trim()}\n:::`
  );
  
  // 3. Wrap TL;DR section: find ## TL;DR and wrap until next ## or --- or end
  result = result.replace(
    /^(##\s*TL;DR\s*)\n([\s\S]*?)(?=\n##\s|\n---\s*\n|$)/gm,
    (_, heading, body) => `:::tldr\n${heading}\n${body.trim()}\n:::`
  );
  
  // 4. Collapse 3+ consecutive newlines to 2
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

/**
 * Parse content into blocks (markdown, transcript, tldr)
 * This allows us to render special blocks with custom components
 */
function parseContentBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const directiveRegex = /:::(transcript|tldr)(?:\[([^\]]*)\])?\n([\s\S]*?)\n:::/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = directiveRegex.exec(content)) !== null) {
    // Add preceding markdown
    if (match.index > lastIndex) {
      const mdContent = content.slice(lastIndex, match.index).trim();
      if (mdContent) {
        blocks.push({ type: 'markdown', content: mdContent });
      }
    }
    
    // Add directive block
    blocks.push({
      type: match[1] as 'transcript' | 'tldr',
      content: match[3],
      label: match[2],
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining markdown
  if (lastIndex < content.length) {
    const mdContent = content.slice(lastIndex).trim();
    if (mdContent) {
      blocks.push({ type: 'markdown', content: mdContent });
    }
  }
  
  // If no blocks were found, treat entire content as markdown
  return blocks.length > 0 ? blocks : [{ type: 'markdown', content }];
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Collapsible transcript block with polished styling
 */
function TranscriptCollapsible({ 
  label, 
  children 
}: { 
  label: string; 
  children: React.ReactNode; 
}) {
  return (
    <details className="group my-6 border border-stone-200 dark:border-stone-700 rounded-lg bg-stone-50/50 dark:bg-stone-800/20 overflow-hidden">
      <summary className={cn(
        "px-4 py-3 cursor-pointer select-none",
        "flex items-center gap-2",
        "text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400",
        "hover:bg-stone-100/50 dark:hover:bg-stone-700/30 transition-colors",
        "list-none [&::-webkit-details-marker]:hidden",
      )}>
        <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90" />
        {label}
      </summary>
      <div className="px-4 pb-4 pt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed border-t border-stone-200/50 dark:border-stone-700/50">
        {children}
      </div>
    </details>
  );
}

/**
 * TL;DR callout block with calm, editorial styling
 */
function TldrCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(
      "my-6 px-5 py-4",
      "bg-stone-50/60 dark:bg-stone-800/30",
      "border-l-4 border-stone-300 dark:border-stone-600",
      "rounded-r-lg",
      // Override nested prose styling for tighter layout
      "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      // TL;DR heading style override
      "[&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wider",
      "[&_h2]:text-stone-500 [&_h2]:dark:text-stone-400",
      "[&_h2]:border-none [&_h2]:pt-0 [&_h2]:mt-0 [&_h2]:mb-2",
    )}>
      {children}
    </div>
  );
}

/**
 * Auto-resizing textarea that grows with content
 */
function AutoResizeTextarea({ 
  value, 
  onChange,
  className,
  ...props 
}: { 
  value: string; 
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);
  
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);
  
  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      className={className}
      rows={3}
      {...props}
    />
  );
}

/**
 * Audio player component using native HTML5 audio
 */
function AudioPlayer({ audioRelpath }: { audioRelpath: string }) {
  const audioUrl = `/api/audio/${audioRelpath}`;
  
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <audio 
          controls 
          src={audioUrl}
          className="w-full h-10"
          preload="metadata"
        >
          Your browser does not support the audio element.
        </audio>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Markdown Components Configuration
// ============================================================================

/**
 * Custom markdown components with heading IDs for scroll-to-section
 */
const markdownComponents: Components = {
  h2: ({ children, ...props }) => {
    const text = String(children);
    const id = generateHeadingId(text);

    return (
      <h2
        id={id}
        className={cn(
          'scroll-mt-8',
          'mt-10 pt-6 mb-5',
          'border-t border-stone-200/80 dark:border-stone-700/60',
          'text-2xl font-bold tracking-tight leading-tight',
          'text-stone-950 dark:text-stone-50'
        )}
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    const text = String(children);
    const id = generateHeadingId(text);

    return (
      <h3
        id={id}
        className={cn(
          'scroll-mt-8',
          'mt-8 mb-3',
          'text-lg font-semibold tracking-tight leading-snug',
          'text-stone-900 dark:text-stone-100'
        )}
        {...props}
      >
        {children}
      </h3>
    );
  },
  // Blockquotes as subtle callouts
  blockquote: ({ children, ...props }) => (
    <blockquote 
      className="border-l-4 border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 my-4 rounded-r-lg not-italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
};

// ============================================================================
// NoteSection Component
// ============================================================================

/**
 * Render a single section with appropriate styling
 * In edit mode, renders an editable textarea instead of markdown
 */
function NoteSection({ section, isEditing, editedContent, onContentChange }: NoteSectionProps) {
  // Skip empty sections in view mode
  if (!isEditing && !section.content.trim()) {
    return null;
  }
  
  const isEditable = !NON_EDITABLE_SECTIONS.includes(section.name);
  const label = SECTION_LABELS[section.name] || section.name;
  
  // Edit mode
  if (isEditing && isEditable) {
    // For transcript, strip the <details> wrapper for editing
    let contentToEdit = editedContent ?? section.content;
    
    // Extract content from details/summary wrapper if present
    const detailsMatch = contentToEdit.match(/<details>\s*<summary>.*?<\/summary>\s*([\s\S]*?)\s*<\/details>/);
    if (detailsMatch) {
      contentToEdit = detailsMatch[1].trim();
    }
    
    // Also strip the ## header if present (we show it as a label)
    const headerMatch = contentToEdit.match(/^##\s+[^\n]+\n+([\s\S]*)$/);
    if (headerMatch) {
      contentToEdit = headerMatch[1].trim();
    }
    
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <AutoResizeTextarea
          value={contentToEdit}
          onChange={(value) => onContentChange?.(value)}
          className="min-h-[100px] font-mono text-sm"
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      </div>
    );
  }

  // View mode - sanitize and parse content into blocks
  const sanitized = sanitizeForRender(section.content);
  const blocks = parseContentBlocks(sanitized);

  return (
    <div className={PROSE_CLASSES}>
      {blocks.map((block, index) => {
        if (block.type === 'transcript') {
          return (
            <TranscriptCollapsible key={index} label={block.label || 'Transcript'}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {block.content}
              </ReactMarkdown>
            </TranscriptCollapsible>
          );
        }
        
        if (block.type === 'tldr') {
          return (
            <TldrCallout key={index}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {block.content}
              </ReactMarkdown>
            </TldrCallout>
          );
        }
        
        return (
          <ReactMarkdown 
            key={index}
            remarkPlugins={[remarkGfm]} 
            components={markdownComponents}
          >
            {block.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main NoteViewer Component
// ============================================================================

/**
 * NoteViewer - Renders parsed vault markdown with premium typography
 * 
 * Features:
 * - Premium typography inspired by Bear/Craft/Reflect
 * - Strips frontmatter and section markers
 * - TL;DR sections rendered as calm callouts
 * - Transcript sections as polished collapsibles
 * - H2 headings as "chapter breaks" with subtle dividers
 * - Tight, scannable lists
 * - Edit mode: per-section textareas for editable content
 */
export function NoteViewer({ 
  noteContent, 
  audioRelpath,
  isEditing = false,
  editedSections = {},
  onSectionChange,
}: NoteViewerProps) {
  // Parse the note content
  const parsed = useMemo(() => parseNoteContent(noteContent), [noteContent]);
  
  // Filter out sections we handle separately
  const contentSections = useMemo(() => 
    parsed.sections.filter(s => !SKIP_SECTIONS.includes(s.name)),
    [parsed.sections]
  );
  
  const handleSectionChange = useCallback((sectionName: string, content: string) => {
    onSectionChange?.(sectionName, content);
  }, [onSectionChange]);
  
  return (
    <div className="space-y-4">
      {/* Audio player if available */}
      {audioRelpath && (
        <AudioPlayer audioRelpath={audioRelpath} />
      )}
      
      {/* Title (not editable) */}
      {parsed.title && (
        <h1 className="text-2xl font-bold tracking-tight leading-tight text-stone-950 dark:text-stone-50">
          {parsed.title}
        </h1>
      )}
      
      {/* Render each content section */}
      {contentSections.map((section, index) => (
        <NoteSection 
          key={`${section.name}-${index}`} 
          section={section}
          isEditing={isEditing}
          editedContent={editedSections[section.name]}
          onContentChange={(content) => handleSectionChange(section.name, content)}
        />
      ))}
    </div>
  );
}

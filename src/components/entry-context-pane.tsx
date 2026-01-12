'use client';

import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Brain, Lightbulb, Zap, Mic } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RelatedEntries } from '@/components/related-entries';
import type { Entry, EntryResponse, EntryType } from '@/types';
import { cn } from '@/lib/utils';

interface EntryContextPaneProps {
  entry: EntryResponse | Entry; // Allow both types
  onSelectEntry?: (entry: Entry) => void;
}

const TYPE_CONFIG: Record<EntryType, { icon: typeof Brain; label: string }> = {
  'brain-dump': { icon: Brain, label: 'Brain Dump' },
  'daily-reflection': { icon: Lightbulb, label: 'Reflection' },
  'quick-note': { icon: Zap, label: 'Quick Note' },
};

function parseOutline(content: string | undefined | null) {
  if (!content) return [];
  // Matches "## Heading" or "### Heading"
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: { level: number; text: string; id: string }[] = [];
  let match;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const text = match[2].trim();
    // Simple ID generation for scrolling
    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    
    headings.push({ 
      level: match[1].length, 
      text,
      id
    });
  }
  
  // Fallback: If no markdown headings found, try to find "1) Title" style
  if (headings.length === 0) {
    const numberRegex = /^(\d+)\)\s+(.+)$/gm;
    while ((match = numberRegex.exec(content)) !== null) {
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      headings.push({ level: 2, text, id });
    }
  }
  
  return headings;
}

export function EntryContextPane({ entry, onSelectEntry }: EntryContextPaneProps) {
  // Cast to EntryResponse to access noteContent safely if available
  const noteContent = (entry as EntryResponse).noteContent;
  const outline = useMemo(() => parseOutline(noteContent), [noteContent]);
  const typeConfig = TYPE_CONFIG[entry.entryType];
  const TypeIcon = typeConfig.icon;
  
  const scrollToSection = (id: string) => {
    // This assumes the markdown renderer adds ids to headings
    // If not, we might need a more robust scrolling solution
    // For now, let's try finding by text content if ID fails
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-8">
        
        {/* Outline */}
        {outline.length > 0 && (
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
              Outline
            </h4>
            <nav className="space-y-1">
              {outline.map((h, i) => (
                <button
                  key={i}
                  onClick={() => scrollToSection(h.id)}
                  className={cn(
                    "block w-full text-left text-sm text-stone-500 hover:text-stone-900 transition-colors truncate py-0.5",
                    h.level === 3 && "pl-3 text-xs"
                  )}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </section>
        )}

        {outline.length > 0 && <div className="border-t border-stone-100/60" />}

        {/* Related Entries */}
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
            Related
          </h4>
          <RelatedEntries 
            entryId={entry.id} 
            onSelectEntry={onSelectEntry}
            variant="compact"
          />
        </section>

        <div className="border-t border-stone-100/60" />

        {/* Metadata */}
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
            Details
          </h4>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-stone-400">Type</dt>
              <dd className="flex items-center gap-1.5 text-stone-700">
                <TypeIcon className="h-3.5 w-3.5" />
                {typeConfig.label}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-stone-400">Created</dt>
              <dd className="text-stone-700">
                {format(parseISO(entry.createdAt), 'MMM d, yyyy')}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-stone-400">Time</dt>
              <dd className="text-stone-700">
                {format(parseISO(entry.createdAt), 'h:mm a')}
              </dd>
            </div>
            {entry.audioDurationSeconds && (
              <div className="flex items-center justify-between">
                <dt className="text-stone-400 flex items-center gap-1">
                  <Mic className="h-3 w-3" /> Duration
                </dt>
                <dd className="text-stone-700 font-mono text-xs">
                  {Math.floor(entry.audioDurationSeconds / 60)}:{String(Math.floor(entry.audioDurationSeconds % 60)).padStart(2, '0')}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-stone-400">Status</dt>
              <dd className="text-stone-700 capitalize">{entry.stage.replace('_', ' ')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-stone-400">Model</dt>
              <dd className="text-stone-700 text-xs">Ollama/Whisper</dd>
            </div>
          </dl>
        </section>

      </div>
    </ScrollArea>
  );
}

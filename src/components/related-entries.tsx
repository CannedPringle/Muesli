'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Link2,
  Plus,
  X,
  Brain,
  Lightbulb,
  Zap,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useEntryLinks, useSearchEntries } from '@/hooks/use-entry';
import { cn } from '@/lib/utils';
import type { Entry, EntryType } from '@/types';

interface RelatedEntriesProps {
  entryId: string;
  onSelectEntry?: (entry: Entry) => void;
  variant?: 'default' | 'compact';
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { icon: typeof Brain; label: string; color: string }> = {
  'brain-dump': { icon: Brain, label: 'Brain Dump', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  'daily-reflection': { icon: Lightbulb, label: 'Reflection', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  'quick-note': { icon: Zap, label: 'Quick Note', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
};

function RelatedEntryItem({ 
  entry, 
  onSelect, 
  onRemove,
  showRemove = false,
  variant = 'default'
}: { 
  entry: Entry; 
  onSelect?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  variant?: 'default' | 'compact';
}) {
  const typeConfig = ENTRY_TYPE_CONFIG[entry.entryType];
  const TypeIcon = typeConfig.icon;
  const dateStr = format(parseISO(entry.createdAt), 'MMM d, yyyy');
  
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-between group py-1">
        <button
          onClick={onSelect}
          className="flex-1 min-w-0 text-left"
        >
          <div className="text-sm font-medium text-stone-700 group-hover:text-stone-900 truncate">
            {entry.title || typeConfig.label}
          </div>
          <div className="text-[10px] text-stone-400 flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", typeConfig.color.replace('bg-', 'bg-').replace('100', '500'))} />
            {dateStr}
          </div>
        </button>
        {showRemove && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
      <button
        onClick={onSelect}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
      >
        <div className={cn('h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0', typeConfig.color)}>
          <TypeIcon className="h-3 w-3" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">{typeConfig.label}</span>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
        </div>
      </button>
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function LinkEntryDialog({ 
  entryId,
  existingLinkIds,
  onLink,
}: { 
  entryId: string;
  existingLinkIds: Set<string>;
  onLink: (targetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { results, isLoading, search } = useSearchEntries();
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    search({ query: query || undefined });
  };
  
  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      search({});
    }
  };
  
  const handleLink = (targetId: string) => {
    onLink(targetId);
    setOpen(false);
    setSearchQuery('');
  };
  
  // Filter out current entry and already linked entries
  const availableEntries = (results?.entries ?? []).filter(
    e => e.id !== entryId && !existingLinkIds.has(e.id) && e.stage === 'completed'
  );
  
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Plus className="h-3 w-3" />
          Add Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link to Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableEntries.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? 'No matching entries' : 'No entries to link'}
              </div>
            ) : (
              <div className="space-y-1">
                {availableEntries.map((entry) => (
                  <RelatedEntryItem
                    key={entry.id}
                    entry={entry}
                    onSelect={() => handleLink(entry.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RelatedEntries({ entryId, onSelectEntry, variant = 'default' }: RelatedEntriesProps) {
  const { links, isLoading, addLink, removeLink } = useEntryLinks(entryId);
  
  const handleRemove = async (targetId: string) => {
    await removeLink(targetId);
  };
  
  const handleAddLink = async (targetId: string) => {
    await addLink(targetId, 'related');
  };
  
  const allRelated = [
    ...(links?.linked ?? []),
    ...(links?.linkedBy ?? []),
  ];
  
  // Deduplicate in case of bidirectional links
  const uniqueRelated = allRelated.filter(
    (entry, index, self) => index === self.findIndex(e => e.id === entry.id)
  );
  
  const existingLinkIds = new Set(uniqueRelated.map(e => e.id));
  
  if (variant === 'compact') {
    return (
      <div className="space-y-3">
         {/* Minimal header/actions for compact mode */}
        <div className="flex items-center justify-between mb-2">
           <span className="text-[10px] text-stone-400 font-medium">
             {uniqueRelated.length} Linked
           </span>
           <LinkEntryDialog
              entryId={entryId}
              existingLinkIds={existingLinkIds}
              onLink={handleAddLink}
            />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-stone-300" />
          </div>
        ) : uniqueRelated.length === 0 ? (
          <p className="text-xs text-stone-400 italic">
            No related entries yet
          </p>
        ) : (
          <div className="space-y-1">
            {uniqueRelated.map((entry) => (
              <RelatedEntryItem
                key={entry.id}
                entry={entry}
                onSelect={() => onSelectEntry?.(entry)}
                onRemove={() => handleRemove(entry.id)}
                showRemove
                variant="compact"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Entries
          </CardTitle>
          <LinkEntryDialog
            entryId={entryId}
            existingLinkIds={existingLinkIds}
            onLink={handleAddLink}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : uniqueRelated.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No related entries yet
          </p>
        ) : (
          <div className="space-y-1">
            {uniqueRelated.map((entry) => (
              <RelatedEntryItem
                key={entry.id}
                entry={entry}
                onSelect={() => onSelectEntry?.(entry)}
                onRemove={() => handleRemove(entry.id)}
                showRemove
                variant="default"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

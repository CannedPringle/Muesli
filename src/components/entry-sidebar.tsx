'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { 
  Search,
  Plus,
  Brain,
  Lightbulb,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useSearchEntries } from '@/hooks/use-entry';
import { cn } from '@/lib/utils';
import type { Entry, JobStage, EntryType } from '@/types';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

interface EntrySidebarProps {
  selectedEntryId: string | null;
  onSelectEntry: (entry: Entry) => void;
  onNewEntry: () => void;
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { icon: typeof Brain; label: string; color: string }> = {
  'brain-dump': { icon: Brain, label: 'Brain Dump', color: 'text-purple-600 dark:text-purple-400' },
  'daily-reflection': { icon: Lightbulb, label: 'Reflection', color: 'text-amber-600 dark:text-amber-400' },
  'quick-note': { icon: Zap, label: 'Quick Note', color: 'text-blue-600 dark:text-blue-400' },
};

const STAGE_CONFIG: Record<JobStage, { icon: typeof Clock; label: string; color: string; isProcessing: boolean }> = {
  pending: { icon: Clock, label: 'Pending', color: 'text-stone-400', isProcessing: false },
  queued: { icon: Clock, label: 'Queued', color: 'text-stone-400', isProcessing: false },
  normalizing: { icon: Loader2, label: 'Processing', color: 'text-blue-500', isProcessing: true },
  transcribing: { icon: Loader2, label: 'Transcribing', color: 'text-blue-500', isProcessing: true },
  awaiting_review: { icon: Clock, label: 'Review', color: 'text-amber-500', isProcessing: false },
  awaiting_prompts: { icon: Clock, label: 'Input', color: 'text-amber-500', isProcessing: false },
  generating: { icon: Loader2, label: 'Generating', color: 'text-blue-500', isProcessing: true },
  writing: { icon: Loader2, label: 'Writing', color: 'text-blue-500', isProcessing: true },
  completed: { icon: CheckCircle2, label: 'Done', color: 'text-emerald-500', isProcessing: false },
  failed: { icon: AlertCircle, label: 'Failed', color: 'text-red-500', isProcessing: false },
  cancel_requested: { icon: Clock, label: 'Cancelling', color: 'text-stone-400', isProcessing: false },
  cancelled: { icon: AlertCircle, label: 'Cancelled', color: 'text-stone-400', isProcessing: false },
};

type DateGroup = {
  label: string;
  entries: Entry[];
};

function groupEntriesByDate(entries: Entry[]): DateGroup[] {
  const groups: Map<string, Entry[]> = new Map();
  
  for (const entry of entries) {
    const date = parseISO(entry.createdAt);
    let groupLabel: string;
    
    if (isToday(date)) {
      groupLabel = 'Today';
    } else if (isYesterday(date)) {
      groupLabel = 'Yesterday';
    } else if (isThisWeek(date)) {
      groupLabel = 'This Week';
    } else {
      groupLabel = format(date, 'MMMM yyyy');
    }
    
    const existing = groups.get(groupLabel) || [];
    existing.push(entry);
    groups.set(groupLabel, existing);
  }
  
  return Array.from(groups.entries()).map(([label, entries]) => ({
    label,
    entries,
  }));
}

function EntryListItem({ 
  entry, 
  isSelected, 
  onSelect 
}: { 
  entry: Entry; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const typeConfig = ENTRY_TYPE_CONFIG[entry.entryType];
  const stageConfig = STAGE_CONFIG[entry.stage];
  const TypeIcon = typeConfig.icon;
  const StageIcon = stageConfig.icon;
  
  const timeStr = format(parseISO(entry.createdAt), 'h:mm a');
  
  return (
    <div className="px-3 py-0.5">
      <button
        onClick={onSelect}
        className={cn(
          'group flex flex-col gap-1 w-full p-3 rounded-lg text-left transition-all duration-200 border border-transparent',
          isSelected 
            ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm' 
            : 'hover:bg-stone-100/80 dark:hover:bg-stone-900/50'
        )}
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className={cn(
            "font-medium text-sm truncate",
            isSelected ? "text-stone-900 dark:text-stone-100" : "text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100"
          )}>
            {entry.title || typeConfig.label}
          </span>
          <span className="text-[10px] text-stone-400 font-mono tracking-tight flex-shrink-0 ml-2">
            {timeStr}
          </span>
        </div>
        
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1.5 text-xs", typeConfig.color)}>
              <TypeIcon className="w-3 h-3" />
              <span className="opacity-90">{typeConfig.label}</span>
            </div>
          </div>
          
          {/* Status Dot */}
          <div className={cn('flex items-center', stageConfig.color)}>
            <StageIcon className={cn('h-3 w-3', stageConfig.isProcessing && 'animate-spin')} />
          </div>
        </div>
      </button>
    </div>
  );
}

function DateGroupSection({ 
  group, 
  selectedEntryId, 
  onSelectEntry,
  defaultOpen = true,
}: { 
  group: DateGroup; 
  selectedEntryId: string | null;
  onSelectEntry: (entry: Entry) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {group.label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 animate-accordion-down overflow-hidden">
          {group.entries.map((entry) => (
            <EntryListItem
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedEntryId}
              onSelect={() => onSelectEntry(entry)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20 bg-stone-200 dark:bg-stone-800" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg bg-stone-100 dark:bg-stone-900" />
        ))}
      </div>
    </div>
  );
}

export function EntrySidebar({ selectedEntryId, onSelectEntry, onNewEntry }: EntrySidebarProps) {
  const { results, isLoading, error, search } = useSearchEntries();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const isInitialMount = useRef(true);
  
  // Debounce search query
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  // Map status filter to API format
  const apiStatus = useMemo(() => {
    if (statusFilter === 'in-progress') return 'active';
    if (statusFilter === 'completed') return 'done';
    if (statusFilter === 'failed') return 'failed';
    return undefined;
  }, [statusFilter]);
  
  // Perform search when filters change
  useEffect(() => {
    search({
      query: debouncedQuery || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      status: apiStatus,
    });
  }, [debouncedQuery, typeFilter, apiStatus, search]);
  
  // Initial load
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      search({});
    }
  }, [search]);
  
  const entries = results?.entries ?? [];
  
  // Group by date
  const groupedEntries = useMemo(() => 
    groupEntriesByDate(entries), 
    [entries]
  );

  const hasFilters = searchQuery || typeFilter !== 'all' || statusFilter !== 'all';
  
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
  }, []);

  return (
    <div className="h-full flex flex-col bg-stone-50 dark:bg-stone-950">
      {/* Header Area */}
      <div className="p-4 space-y-4 flex-shrink-0">
        <Button 
          onClick={onNewEntry} 
          className="w-full justify-start pl-3 bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300 hover:bg-white shadow-sm dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:border-stone-700 transition-all" 
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 bg-stone-100/50 border-stone-200 focus:bg-white focus:border-stone-300 dark:bg-stone-900/50 dark:border-stone-800 dark:focus:border-stone-700 transition-all rounded-md"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
             <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
              <span className="text-[10px] text-stone-400 font-mono border border-stone-200 dark:border-stone-800 rounded px-1">⌘K</span>
            </div>
          )}
        </div>
        
        {/* Filters - Minimal */}
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="brain-dump">Brain Dump</SelectItem>
              <SelectItem value="daily-reflection">Reflection</SelectItem>
              <SelectItem value="quick-note">Quick Note</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-xs bg-transparent border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Entry list */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="pb-4">
          {isLoading && entries.length === 0 ? (
            <SidebarSkeleton />
          ) : error ? (
            <div className="text-center py-8 px-4">
              <AlertCircle className="h-6 w-6 text-stone-400 mx-auto mb-2" />
              <p className="text-xs text-stone-500 mb-3">Unable to load entries</p>
              <Button variant="outline" size="sm" onClick={() => search({})} className="h-7 text-xs">
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 px-4">
              {hasFilters ? (
                <>
                  <Filter className="h-8 w-8 text-stone-300 mx-auto mb-3" />
                  <p className="text-sm text-stone-500 font-medium">No matching entries</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-1 text-stone-400 hover:text-stone-900"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-stone-500">No entries yet</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {groupedEntries.map((group, index) => (
                <DateGroupSection
                  key={group.label}
                  group={group}
                  selectedEntryId={selectedEntryId}
                  onSelectEntry={onSelectEntry}
                  defaultOpen={index < 3} // Keep first 3 groups open
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer - Minimal status & Settings */}
      <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-stone-400 uppercase tracking-widest font-medium">
          <span>{entries.length} Entries</span>
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-stone-400" />}
        </div>
        
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

'use client';

import { formatDistanceToNow, format } from 'date-fns';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  Brain,
  Lightbulb,
  Zap,
  MoreHorizontal,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEntries, useOpenNote } from '@/hooks/use-entry';
import type { Entry, JobStage, EntryType } from '@/types';

interface EntryHistoryProps {
  onSelectEntry?: (entry: Entry) => void;
  limit?: number;
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { icon: typeof Brain; label: string; color: string }> = {
  'brain-dump': { icon: Brain, label: 'Brain Dump', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  'daily-reflection': { icon: Lightbulb, label: 'Reflection', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  'quick-note': { icon: Zap, label: 'Quick Note', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
};

const STAGE_CONFIG: Record<JobStage, { icon: typeof Clock; label: string; color: string }> = {
  pending: { icon: Clock, label: 'Pending', color: 'text-muted-foreground' },
  queued: { icon: Clock, label: 'Queued', color: 'text-muted-foreground' },
  normalizing: { icon: Loader2, label: 'Processing', color: 'text-blue-500' },
  transcribing: { icon: Loader2, label: 'Transcribing', color: 'text-blue-500' },
  awaiting_review: { icon: Clock, label: 'Awaiting Review', color: 'text-amber-500' },
  awaiting_prompts: { icon: Clock, label: 'Awaiting Input', color: 'text-amber-500' },
  generating: { icon: Loader2, label: 'Generating', color: 'text-blue-500' },
  writing: { icon: Loader2, label: 'Writing', color: 'text-blue-500' },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-green-500' },
  failed: { icon: AlertCircle, label: 'Failed', color: 'text-red-500' },
  cancel_requested: { icon: Clock, label: 'Cancelling', color: 'text-muted-foreground' },
  cancelled: { icon: AlertCircle, label: 'Cancelled', color: 'text-muted-foreground' },
};

function EntryHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EntryCard({ entry, onOpen }: { entry: Entry; onOpen?: () => void }) {
  const { openInObsidian, revealInFinder, isOpening } = useOpenNote();
  const typeConfig = ENTRY_TYPE_CONFIG[entry.entryType];
  const stageConfig = STAGE_CONFIG[entry.stage];
  const TypeIcon = typeConfig.icon;
  const StageIcon = stageConfig.icon;
  const isProcessing = ['normalizing', 'transcribing', 'extracting', 'generating', 'writing'].includes(entry.stage);
  
  const formattedDate = entry.createdAt 
    ? formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })
    : 'Unknown date';
  
  const fullDate = entry.createdAt 
    ? format(new Date(entry.createdAt), 'PPP p')
    : '';

  const handleOpenObsidian = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await openInObsidian(entry.id);
  };

  const handleRevealFinder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await revealInFinder(entry.id);
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.()}
    >
      {/* Type icon */}
      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${typeConfig.color}`}>
        <TypeIcon className="h-5 w-5" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{typeConfig.label}</span>
          {entry.audioDurationSeconds && (
            <span className="text-xs text-muted-foreground">
              {Math.floor(entry.audioDurationSeconds / 60)}:{String(Math.floor(entry.audioDurationSeconds % 60)).padStart(2, '0')}
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground" title={fullDate}>
          {formattedDate}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={`${stageConfig.color} flex items-center gap-1`}>
          <StageIcon className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{stageConfig.label}</span>
        </Badge>

        {/* Actions dropdown for completed entries */}
        {entry.stage === 'completed' && entry.noteRelpath && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenObsidian} disabled={isOpening}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Obsidian
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRevealFinder} disabled={isOpening}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Reveal in Finder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
      </div>
    </div>
  );
}

export function EntryHistory({ onSelectEntry, limit = 20 }: EntryHistoryProps) {
  const { entries, isLoading, error, refetch } = useEntries(limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EntryHistorySkeleton />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Failed to load entries</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No entries yet</p>
            <p className="text-sm text-muted-foreground/70">
              Create your first journal entry to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Entries
          <Badge variant="secondary" className="ml-auto">
            {entries.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {entries.map((entry) => (
              <EntryCard 
                key={entry.id} 
                entry={entry} 
                onOpen={() => onSelectEntry?.(entry)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

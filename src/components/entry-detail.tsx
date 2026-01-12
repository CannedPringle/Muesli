'use client';

import { useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Lightbulb,
  Zap,
  AlertCircle,
  Loader2,
  ExternalLink,
  FolderOpen,
  Calendar,
  Pencil,
  Save,
  Play,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEntry, useOpenNote } from '@/hooks/use-entry';
import { parseNoteContent } from '@/lib/note-parser';
import { cn } from '@/lib/utils';
import { JobProgress } from '@/components/job-progress';
import { TranscriptEditor } from '@/components/transcript-editor';
import { NoteViewer } from '@/components/note-viewer';
import type { Entry, EntryType } from '@/types';
import { Separator } from '@/components/ui/separator';

interface EntryDetailProps {
  entryId: string;
  onNewEntry?: () => void;
  onEntryUpdated?: () => void;
  onSelectEntry?: (entry: Entry) => void;
  contextPaneOpen?: boolean;
  onToggleContextPane?: () => void;
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { icon: typeof Brain; label: string; color: string }> = {
  'brain-dump': { icon: Brain, label: 'Brain Dump', color: 'text-purple-600 dark:text-purple-400' },
  'daily-reflection': { icon: Lightbulb, label: 'Daily Reflection', color: 'text-amber-600 dark:text-amber-400' },
  'quick-note': { icon: Zap, label: 'Quick Note', color: 'text-blue-600 dark:text-blue-400' },
};

function DetailSkeleton() {
  return (
    <div className="h-full w-full bg-stone-50/50 dark:bg-stone-950 flex flex-col items-center p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] min-h-[calc(100vh-6rem)] p-12 space-y-8">
         <div className="space-y-4">
           <Skeleton className="h-4 w-32 bg-stone-100 dark:bg-stone-800" />
           <Skeleton className="h-10 w-3/4 bg-stone-100 dark:bg-stone-800" />
         </div>
         <div className="space-y-4 pt-8">
           <Skeleton className="h-4 w-full bg-stone-100 dark:bg-stone-800" />
           <Skeleton className="h-4 w-full bg-stone-100 dark:bg-stone-800" />
           <Skeleton className="h-4 w-2/3 bg-stone-100 dark:bg-stone-800" />
         </div>
      </div>
    </div>
  );
}

export function EntryDetail({ 
  entryId, 
  onNewEntry: _onNewEntry, 
  onEntryUpdated, 
  onSelectEntry: _onSelectEntry, 
  contextPaneOpen = true, 
  onToggleContextPane 
}: EntryDetailProps) {
  const { entry, isLoading, error, refetch, updateEntry } = useEntry(entryId);
  const { openInObsidian, revealInFinder } = useOpenNote();
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showExternalEditWarning, setShowExternalEditWarning] = useState(false);
  
  // Initialize edited sections from parsed note content
  const initializeEditSections = useCallback(() => {
    if (!entry?.noteContent) return {};
    
    const parsed = parseNoteContent(entry.noteContent);
    const sections: Record<string, string> = {};
    
    for (const section of parsed.sections) {
      if (['RELATED', 'AUDIO'].includes(section.name)) continue;
      
      let content = section.content;
      
      // For transcript, extract content from details/summary wrapper
      const detailsMatch = content.match(/<details>\s*<summary>.*?<\/summary>\s*([\s\S]*?)\s*<\/details>/);
      if (detailsMatch) {
        content = detailsMatch[1].trim();
      }
      
      // Strip the ## header
      const headerMatch = content.match(/^##\s+[^\n]+\n+([\s\S]*)$/);
      if (headerMatch) {
        content = headerMatch[1].trim();
      }
      
      sections[section.name] = content;
    }
    
    return sections;
  }, [entry?.noteContent]);
  
  // Handle starting edit mode
  const handleStartEdit = useCallback(() => {
    if (entry?.hasExternalEdits) {
      setShowExternalEditWarning(true);
    } else {
      setEditedSections(initializeEditSections());
      setIsEditing(true);
    }
  }, [entry?.hasExternalEdits, initializeEditSections]);
  
  // Confirm edit despite external changes
  const handleConfirmEdit = useCallback(() => {
    setShowExternalEditWarning(false);
    setEditedSections(initializeEditSections());
    setIsEditing(true);
  }, [initializeEditSections]);
  
  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedSections({});
  }, []);
  
  // Save edited sections
  const handleSaveEdit = useCallback(async () => {
    if (!entry) return;
    
    setIsSaving(true);
    try {
      await updateEntry({ editedSections });
      setIsEditing(false);
      setEditedSections({});
      onEntryUpdated?.();
      refetch();
    } catch (err) {
      console.error('Failed to save edits:', err);
    } finally {
      setIsSaving(false);
    }
  }, [entry, editedSections, updateEntry, onEntryUpdated, refetch]);
  
  // Handle section content change
  const handleSectionChange = useCallback((sectionName: string, content: string) => {
    setEditedSections(prev => ({
      ...prev,
      [sectionName]: content,
    }));
  }, []);

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !entry) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-stone-50/50 dark:bg-stone-950">
        <div className="text-center max-w-sm px-4">
          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-stone-900">
             <AlertCircle className="h-6 w-6 text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">
            Unable to load entry
          </h3>
          <p className="text-sm text-stone-500 mb-6">
            {error || 'The requested entry could not be found.'}
          </p>
          <Button variant="outline" onClick={refetch}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const typeConfig = ENTRY_TYPE_CONFIG[entry.entryType];
  const TypeIcon = typeConfig.icon;
  const isProcessing = ['pending', 'queued', 'normalizing', 'transcribing', 'generating', 'writing'].includes(entry.stage);
  const needsReview = entry.stage === 'awaiting_review';
  const isCompleted = entry.stage === 'completed';
  const isFailed = entry.stage === 'failed' || entry.stage === 'cancelled';

  const handleContinue = async () => {
    try {
      await updateEntry({ action: 'continue' });
      onEntryUpdated?.();
    } catch (err) {
      console.error('Failed to continue:', err);
    }
  };

  const handleOpenObsidian = async () => {
    await openInObsidian(entry.id);
  };

  const handleRevealFinder = async () => {
    await revealInFinder(entry.id);
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-stone-50/30 dark:bg-stone-950 overflow-hidden relative">
      <ScrollArea className="flex-1 min-h-0">
         <div className="flex flex-col items-center py-8 px-4">
            
            {/* The "Sheet of Paper" */}
            <div className="w-full max-w-[720px] bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-800 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md duration-500">
               
               {/* Header Info (Inside the paper) */}
               <div className="px-12 pt-12 pb-8 border-b border-stone-100/50 dark:border-stone-800/50">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-stone-400">
                        <span className="flex items-center gap-1.5">
                           <Calendar className="h-3.5 w-3.5" />
                           {format(parseISO(entry.createdAt), 'MMMM d, yyyy')}
                        </span>
                        <span className="text-stone-300 dark:text-stone-700">•</span>
                        <span>{format(parseISO(entry.createdAt), 'h:mm a')}</span>
                     </div>

                     <div className="flex items-center gap-2">
                        {entry.audioDurationSeconds && (
                           <div className="flex items-center gap-2 px-2 py-1 bg-stone-50 dark:bg-stone-800/50 rounded-md border border-stone-100 dark:border-stone-800">
                              <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-transparent text-stone-500">
                                 <Play className="h-2.5 w-2.5 fill-current" />
                              </Button>
                              <span className="text-[10px] font-mono text-stone-400">
                                 {Math.floor(entry.audioDurationSeconds / 60)}:{String(Math.floor(entry.audioDurationSeconds % 60)).padStart(2, '0')}
                              </span>
                           </div>
                        )}

                        {isCompleted && (
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-300 hover:text-stone-600 dark:hover:text-stone-100">
                                    <MoreHorizontal className="h-4 w-4" />
                                 </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={handleOpenObsidian}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Open in Obsidian
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={handleRevealFinder}>
                                    <FolderOpen className="mr-2 h-4 w-4" /> Reveal in Finder
                                 </DropdownMenuItem>
                                 <Separator className="my-1" />
                                 <DropdownMenuItem onClick={handleStartEdit}>
                                    <Pencil className="mr-2 h-4 w-4" /> Edit Entry
                                 </DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                        )}
                        
                        {/* Context Pane Toggle */}
                        {onToggleContextPane && (
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={onToggleContextPane}
                              className="h-7 w-7 text-stone-300 hover:text-stone-600 dark:hover:text-stone-100"
                              title={contextPaneOpen ? "Hide context panel" : "Show context panel"}
                           >
                              {contextPaneOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                           </Button>
                        )}
                     </div>
                  </div>

                  <div className="space-y-3">
                     <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border w-fit", 
                        typeConfig.color.replace('text-', 'bg-').replace('600', '50').replace('400', '900/20') + ' ' + typeConfig.color.replace('text-', 'border-').replace('600', '100').replace('400', '800')
                     )}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeConfig.label}
                     </div>
                     <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans text-balance leading-tight">
                        {entry.title || "Untitled Entry"}
                     </h1>
                  </div>
               </div>

               {/* Main Content Body */}
               <div className="px-12 py-10">
                  {/* Processing State */}
                  {isProcessing && (
                     <div className="mb-12 p-8 border border-blue-100 dark:border-blue-900/30 rounded-xl bg-blue-50/50 dark:bg-blue-950/10">
                        <JobProgress 
                           stage={entry.stage}
                           stageMessage={entry.stageMessage}
                           errorMessage={entry.errorMessage}
                        />
                     </div>
                  )}

                  {/* Review State */}
                  {needsReview && entry.rawTranscript && (
                     <div className="space-y-6 mb-12">
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                           Please review the transcript before we generate your journal entry.
                        </div>
                        <TranscriptEditor
                           transcript={entry.rawTranscript}
                           editedTranscript={entry.editedTranscript}
                           onSave={(text) => {
                              updateEntry({ editedTranscript: text });
                           }}
                           onContinue={handleContinue}
                        />
                     </div>
                  )}

                  {/* Failed State */}
                  {isFailed && (
                     <Alert variant="destructive" className="mb-8">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                           {entry.errorMessage || 'This entry failed to process.'}
                        </AlertDescription>
                     </Alert>
                  )}

                  {/* Main Content (The "Bear" Typography) */}
                  {isCompleted && entry.noteContent && (
                     <div className="animate-in fade-in duration-700 slide-in-from-bottom-4">
                        <NoteViewer 
                           noteContent={entry.noteContent}
                           audioRelpath={entry.normalizedAudioRelpath || entry.originalAudioRelpath}
                           isEditing={isEditing}
                           editedSections={editedSections}
                           onSectionChange={handleSectionChange}
                        />
                     </div>
                  )}
                  
                  {/* Fallback Transcript View */}
                  {isCompleted && !entry.noteContent && (entry.editedTranscript || entry.rawTranscript) && (
                     <div className="prose prose-stone prose-lg max-w-none">
                        <h3>Transcript</h3>
                        <p>{entry.editedTranscript || entry.rawTranscript}</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </ScrollArea>

      {/* Edit Actions Footer (Sticky if editing) */}
      {isEditing && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-stone-900/90 backdrop-blur-md rounded-full shadow-2xl text-white animate-in slide-in-from-bottom-4">
            <Button 
               size="sm" 
               onClick={handleSaveEdit} 
               disabled={isSaving}
               className="rounded-full px-6 bg-white text-stone-900 hover:bg-stone-200"
            >
               {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Save className="h-3 w-3 mr-2" />}
               Save Changes
            </Button>
            <Button 
               size="sm" 
               variant="ghost" 
               onClick={handleCancelEdit} 
               disabled={isSaving}
               className="rounded-full text-stone-300 hover:text-white hover:bg-stone-800"
            >
               Cancel
            </Button>
         </div>
      )}

      {/* Warning Dialog */}
      <Dialog open={showExternalEditWarning} onOpenChange={setShowExternalEditWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note Modified Externally</DialogTitle>
            <DialogDescription>
              This note has been modified in Obsidian. Editing here will overwrite those changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExternalEditWarning(false)}>Cancel</Button>
            <Button onClick={handleConfirmEdit}>Edit Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

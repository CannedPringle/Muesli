'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Folder, RotateCcw, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NoteActionsProps {
  noteContent?: string | null;
  noteRelpath?: string | null;
  onOpenInObsidian: () => void;
  onRevealInFinder: () => void;
  onRegenerate?: () => void;
  onNewEntry: () => void;
  isOpening?: boolean;
  hasExternalEdits?: boolean;
}

export function NoteActions({
  noteContent,
  noteRelpath,
  onOpenInObsidian,
  onRevealInFinder,
  onRegenerate,
  onNewEntry,
  isOpening,
  hasExternalEdits,
}: NoteActionsProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Journal Entry Created</span>
            {noteRelpath && (
              <span className="text-sm font-normal text-muted-foreground">
                {noteRelpath}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {noteContent && (
            <ScrollArea className="h-[300px] w-full rounded-md border p-4 mb-4">
              <pre className="text-sm whitespace-pre-wrap font-mono">{noteContent}</pre>
            </ScrollArea>
          )}

          {hasExternalEdits && (
            <p className="text-sm text-amber-600 mb-4">
              Note: This file has been modified in Obsidian since it was created.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={onOpenInObsidian} disabled={isOpening}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Obsidian
            </Button>
            <Button variant="outline" onClick={onRevealInFinder} disabled={isOpening}>
              <Folder className="h-4 w-4 mr-2" />
              Reveal in Finder
            </Button>
            {onRegenerate && (
              <Button variant="outline" onClick={onRegenerate}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}
            <Button variant="secondary" onClick={onNewEntry}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

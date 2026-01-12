'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Edit2, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TranscriptEditorProps {
  transcript: string;
  editedTranscript?: string | null;
  isLocked?: boolean;
  onSave: (editedTranscript: string) => void;
  onContinue: () => void;
  hasExternalEdits?: boolean;
}

export function TranscriptEditor({
  transcript,
  editedTranscript,
  isLocked,
  onSave,
  onContinue,
  hasExternalEdits,
}: TranscriptEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(editedTranscript || transcript);

  const handleEdit = () => {
    setEditValue(editedTranscript || transcript);
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(editedTranscript || transcript);
    setIsEditing(false);
  };

  const displayText = editedTranscript || transcript;
  const hasEdits = editedTranscript && editedTranscript !== transcript;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Transcript</CardTitle>
          {!isEditing && !isLocked && (
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        {hasEdits && !isEditing && (
          <p className="text-xs text-muted-foreground">
            You have made edits to the original transcript
          </p>
        )}
      </CardHeader>
      <CardContent>
        {hasExternalEdits && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This note has been modified in Obsidian. Regenerating may overwrite those changes.
            </AlertDescription>
          </Alert>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Transcript text..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg max-h-[300px] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{displayText}</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={onContinue}>
                Continue
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

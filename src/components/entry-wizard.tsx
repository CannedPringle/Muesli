'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AudioRecorder } from '@/components/audio-recorder';
import { AudioUpload } from '@/components/audio-upload';
import { EntryTypeSelector } from '@/components/entry-type-selector';
import { JobProgress } from '@/components/job-progress';
import { TranscriptEditor } from '@/components/transcript-editor';
import { PromptForm } from '@/components/prompt-form';
import { NoteActions } from '@/components/note-actions';
import { 
  useCreateEntry, 
  useUploadAudio, 
  useEntry,
  useOpenNote,
} from '@/hooks/use-entry';
import type { EntryType, PromptAnswers } from '@/types';

type WizardStep = 'select-type' | 'record' | 'processing' | 'review' | 'prompts' | 'complete';

interface EntryWizardProps {
  onComplete?: () => void;
}

export function EntryWizard({ onComplete }: EntryWizardProps) {
  const [step, setStep] = useState<WizardStep>('select-type');
  const [entryType, setEntryType] = useState<EntryType>('brain-dump');
  const [entryId, setEntryId] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<'record' | 'upload'>('record');

  const { createEntry, isCreating } = useCreateEntry();
  const { uploadAudio, isUploading } = useUploadAudio();
  const { entry, updateEntry, cancelEntry, refetch } = useEntry(entryId);
  const { openInObsidian, revealInFinder, isOpening } = useOpenNote();

  // Watch entry stage and update wizard step accordingly
  useEffect(() => {
    if (!entry) return;

    switch (entry.stage) {
      case 'queued':
      case 'normalizing':
      case 'transcribing':
      case 'generating':
      case 'writing':
      case 'cancel_requested':
        setStep('processing');
        break;
      case 'awaiting_review':
        setStep('review');
        break;
      case 'awaiting_prompts':
        setStep('prompts');
        break;
      case 'completed':
        setStep('complete');
        break;
      case 'failed':
      case 'cancelled':
        // Stay on processing to show error
        setStep('processing');
        break;
    }
  }, [entry?.stage]);

  const handleSelectType = () => {
    setStep('record');
  };

  const handleAudioReady = async (audioBlob: Blob | File) => {
    try {
      // Create entry first
      const id = await createEntry(entryType);
      setEntryId(id);
      
      // Upload audio (this starts processing)
      const blob = audioBlob instanceof File ? audioBlob : audioBlob;
      const filename = audioBlob instanceof File ? audioBlob.name : 'recording.webm';
      await uploadAudio(id, blob, filename);
      
      setStep('processing');
    } catch (err) {
      console.error('Error starting entry:', err);
    }
  };

  const handleCancel = async () => {
    if (entryId) {
      await cancelEntry();
    }
  };

  const handleTranscriptSave = async (editedTranscript: string) => {
    await updateEntry({ editedTranscript });
  };

  const handleTranscriptContinue = async () => {
    await updateEntry({ action: 'continue' });
  };

  const handlePromptsSave = async (answers: PromptAnswers) => {
    await updateEntry({ promptAnswers: answers });
  };

  const handlePromptsContinue = async () => {
    await updateEntry({ action: 'continue' });
  };

  const handleNewEntry = () => {
    setEntryId(null);
    setStep('select-type');
    setEntryType('brain-dump');
    onComplete?.();
  };

  const handleOpenInObsidian = async () => {
    if (entryId) {
      await openInObsidian(entryId);
    }
  };

  const handleRevealInFinder = async () => {
    if (entryId) {
      await revealInFinder(entryId);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step: Select Entry Type */}
      {step === 'select-type' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">New Journal Entry</h2>
            <p className="text-muted-foreground">
              Choose the type of entry you want to create
            </p>
          </div>
          
          <EntryTypeSelector
            value={entryType}
            onChange={setEntryType}
          />
          
          <div className="flex justify-center">
            <Button size="lg" onClick={handleSelectType}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step: Record/Upload Audio */}
      {step === 'record' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              {entryType === 'brain-dump' && 'Brain Dump'}
              {entryType === 'daily-reflection' && 'Daily Reflection'}
              {entryType === 'quick-note' && 'Quick Note'}
            </h2>
            <p className="text-muted-foreground">
              Record your thoughts or upload an existing audio file
            </p>
          </div>

          <Tabs value={audioSource} onValueChange={(v) => setAudioSource(v as 'record' | 'upload')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="record">Record</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="record" className="mt-4">
              <AudioRecorder
                onRecordingComplete={handleAudioReady}
                disabled={isCreating || isUploading}
              />
            </TabsContent>
            <TabsContent value="upload" className="mt-4">
              <AudioUpload
                onFileSelected={handleAudioReady}
                disabled={isCreating || isUploading}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-start">
            <Button variant="ghost" onClick={() => setStep('select-type')}>
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && entry && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Processing</h2>
            <p className="text-muted-foreground">
              Your audio is being transcribed and processed
            </p>
          </div>

          <JobProgress
            stage={entry.stage}
            stageMessage={entry.stageMessage}
            errorMessage={entry.errorMessage}
            onCancel={handleCancel}
            canCancel={!['completed', 'failed', 'cancelled', 'cancel_requested'].includes(entry.stage)}
          />

          {(entry.stage === 'failed' || entry.stage === 'cancelled') && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleNewEntry}>
                Start Over
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step: Review Transcript */}
      {step === 'review' && entry && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Review Transcript</h2>
            <p className="text-muted-foreground">
              Review and edit the transcription if needed
            </p>
          </div>

          <TranscriptEditor
            transcript={entry.rawTranscript || ''}
            editedTranscript={entry.editedTranscript}
            onSave={handleTranscriptSave}
            onContinue={handleTranscriptContinue}
          />
        </div>
      )}

      {/* Step: Edit Prompts */}
      {step === 'prompts' && entry && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Review Prompts</h2>
            <p className="text-muted-foreground">
              Review and edit the extracted content
            </p>
          </div>

          <PromptForm
            promptAnswers={entry.promptAnswers ? JSON.parse(entry.promptAnswers) : {}}
            onSave={handlePromptsSave}
            onContinue={handlePromptsContinue}
          />
        </div>
      )}

      {/* Step: Complete */}
      {step === 'complete' && entry && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Complete!</h2>
            <p className="text-muted-foreground">
              Your journal entry has been created
            </p>
          </div>

          <NoteActions
            noteContent={entry.noteContent}
            noteRelpath={entry.noteRelpath}
            onOpenInObsidian={handleOpenInObsidian}
            onRevealInFinder={handleRevealInFinder}
            onNewEntry={handleNewEntry}
            isOpening={isOpening}
            hasExternalEdits={entry.hasExternalEdits}
          />
        </div>
      )}
    </div>
  );
}

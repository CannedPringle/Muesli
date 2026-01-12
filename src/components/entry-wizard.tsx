'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AudioRecorder } from '@/components/audio-recorder';
import { AudioUpload } from '@/components/audio-upload';
import { EntryTypeSelector } from '@/components/entry-type-selector';
import { JobProgress } from '@/components/job-progress';
import { TranscriptEditor } from '@/components/transcript-editor';
import { PromptForm } from '@/components/prompt-form';
import { NoteActions } from '@/components/note-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { ChevronLeft } from 'lucide-react';
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
  const [entryDate, setEntryDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  const { createEntry, isCreating } = useCreateEntry();
  const { uploadAudio, isUploading } = useUploadAudio();
  const { entry, updateEntry, cancelEntry, refetch } = useEntry(entryId);
  const { openInObsidian, revealInFinder, isOpening } = useOpenNote();

  // Sync entryDate from entry when it's loaded
  useEffect(() => {
    // Check if we need to update to avoid infinite loop
    const syncDate = () => {
      if (entry?.entryDate && entryDate !== entry.entryDate) {
        setEntryDate(entry.entryDate);
      }
    };
    
    syncDate();
  }, [entry?.entryDate, entryDate]);

  // Watch entry stage and update wizard step accordingly
  useEffect(() => {
    if (!entry) return;

    const syncStep = () => {
      setStep((currentStep) => {
        let nextStep = currentStep;

        switch (entry.stage) {
          case 'queued':
          case 'normalizing':
          case 'transcribing':
          case 'generating':
          case 'writing':
          case 'cancel_requested':
            nextStep = 'processing';
            break;
          case 'awaiting_review':
            nextStep = 'review';
            break;
          case 'awaiting_prompts':
            nextStep = 'prompts';
            break;
          case 'completed':
            nextStep = 'complete';
            break;
          case 'failed':
          case 'cancelled':
            // Stay on processing to show error
            nextStep = 'processing';
            break;
        }
        
        return nextStep !== currentStep ? nextStep : currentStep;
      });
    };
    
    syncStep();
  }, [entry?.stage, entry]); // Added entry as dependency

  const handleSelectType = () => {
    setStep('record');
  };

  const handleAudioReady = async (audioBlob: Blob | File) => {
    try {
      // Create entry first with the selected date
      const id = await createEntry(entryType, entryDate);
      setEntryId(id);
      
      // Upload audio (this starts processing)
      const blob = audioBlob instanceof File ? audioBlob : audioBlob;
      const filename = audioBlob instanceof File ? audioBlob.name : 'recording.webm';
      await uploadAudio(id, blob, filename);
      
      // Refetch to get latest state after queuing
      await refetch();
      
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

  const handleDateChange = async (newDate: string) => {
    setEntryDate(newDate);
    if (entryId) {
      await updateEntry({ entryDate: newDate });
    }
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
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
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
    <div className="h-full w-full overflow-y-auto bg-stone-50/30 dark:bg-stone-950/30 p-8">
      <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-center">
        {/* Step: Select Entry Type */}
        {step === 'select-type' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                New Journal Entry
              </h2>
              <p className="text-lg text-stone-500 dark:text-stone-400">
                What kind of thinking do you want to do today?
              </p>
            </div>
            
            <div className="py-4">
              <EntryTypeSelector
                value={entryType}
                onChange={setEntryType}
              />
            </div>

            <div className="max-w-xs mx-auto space-y-4">
              <DatePicker
                value={entryDate}
                onChange={setEntryDate}
                label="Entry Date"
              />
              
              <Button size="lg" className="w-full h-12 text-base" onClick={handleSelectType}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Record/Upload Audio */}
        {step === 'record' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute left-8 top-8 text-stone-500"
                onClick={() => setStep('select-type')}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {entryType === 'brain-dump' && 'Brain Dump'}
                {entryType === 'daily-reflection' && 'Daily Reflection'}
                {entryType === 'quick-note' && 'Quick Note'}
              </h2>
              <p className="text-stone-500 dark:text-stone-400">
                Capture your raw thoughts. We&apos;ll structure them for you.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-white dark:bg-stone-900 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-800">
              <Tabs value={audioSource} onValueChange={(v) => setAudioSource(v as 'record' | 'upload')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="record">Record Audio</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                </TabsList>
                <TabsContent value="record" className="mt-0">
                  <AudioRecorder
                    onRecordingComplete={handleAudioReady}
                    disabled={isCreating || isUploading}
                  />
                </TabsContent>
                <TabsContent value="upload" className="mt-0">
                  <AudioUpload
                    onFileSelected={handleAudioReady}
                    disabled={isCreating || isUploading}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && entry && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Processing Your Thoughts
              </h2>
              <p className="text-stone-500 dark:text-stone-400">
                Transcribing and structuring your entry...
              </p>
            </div>

            <div className="max-w-xl mx-auto">
              <JobProgress
                stage={entry.stage}
                stageMessage={entry.stageMessage}
                errorMessage={entry.errorMessage}
                onCancel={handleCancel}
                canCancel={!['completed', 'failed', 'cancelled', 'cancel_requested'].includes(entry.stage)}
              />
            </div>

            {(entry.stage === 'failed' || entry.stage === 'cancelled') && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={handleNewEntry}>
                  Start Over
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step: Review Transcript */}
        {step === 'review' && entry && (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-300">
            <div className="text-center flex-shrink-0">
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Review Transcript</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm">
                Make any necessary corrections before we generate the journal entry.
              </p>
            </div>

            <div className="flex justify-center flex-shrink-0">
              <DatePicker
                value={entryDate}
                onChange={handleDateChange}
                label="Entry Date"
              />
            </div>

            <div className="flex-1 min-h-0 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
              <TranscriptEditor
                transcript={entry.rawTranscript || ''}
                editedTranscript={entry.editedTranscript}
                onSave={handleTranscriptSave}
                onContinue={handleTranscriptContinue}
              />
            </div>
          </div>
        )}

        {/* Step: Edit Prompts */}
        {step === 'prompts' && entry && (
          <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-300">
             <div className="text-center flex-shrink-0">
              <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Review Key Points</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm">
                Verify the extracted information.
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <PromptForm
                promptAnswers={entry.promptAnswers ? JSON.parse(entry.promptAnswers) : {}}
                onSave={handlePromptsSave}
                onContinue={handlePromptsContinue}
              />
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && entry && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 text-center max-w-lg mx-auto">
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Entry Created!
              </h2>
              <p className="text-stone-500 dark:text-stone-400 text-lg">
                Your thoughts have been captured and structured in your vault.
              </p>
            </div>

            <div className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm text-left">
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
          </div>
        )}
      </div>
    </div>
  );
}

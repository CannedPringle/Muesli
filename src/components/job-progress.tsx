'use client';

import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { JobStage } from '@/types';
import { STAGE_WEIGHTS, calculateOverallProgress } from '@/types';

// Parse error messages and provide actionable suggestions
function getErrorHelp(errorMessage: string | null | undefined, stage: JobStage): {
  title: string;
  description: string;
  action?: { label: string; href?: string; command?: string };
} | null {
  if (!errorMessage) return null;
  
  const msg = errorMessage.toLowerCase();
  
  // Ollama errors
  if (msg.includes('ollama') || msg.includes('econnrefused') && msg.includes('11434')) {
    return {
      title: 'Ollama Not Running',
      description: 'The Ollama service is not responding. Make sure Ollama is running.',
      action: { label: 'Start Ollama', command: 'ollama serve' },
    };
  }
  
  if (msg.includes('model') && (msg.includes('not found') || msg.includes('does not exist'))) {
    return {
      title: 'Model Not Found',
      description: 'The configured LLM model is not installed in Ollama.',
      action: { label: 'Pull Model', command: 'ollama pull qwen2.5:7b' },
    };
  }
  
  // Whisper errors
  if (msg.includes('whisper') && (msg.includes('not found') || msg.includes('enoent'))) {
    return {
      title: 'Whisper Not Found',
      description: 'whisper.cpp is not installed or configured correctly.',
      action: { label: 'Run Setup', command: 'npm run setup:whisper' },
    };
  }
  
  // FFmpeg errors
  if (msg.includes('ffmpeg') && (msg.includes('not found') || msg.includes('enoent'))) {
    return {
      title: 'FFmpeg Not Found',
      description: 'FFmpeg is required for audio processing but was not found.',
      action: { label: 'Install FFmpeg', command: 'brew install ffmpeg' },
    };
  }
  
  // Audio file errors
  if (msg.includes('audio') && (msg.includes('invalid') || msg.includes('corrupt') || msg.includes('format'))) {
    return {
      title: 'Invalid Audio File',
      description: 'The audio file could not be processed. Try a different file format (MP3, M4A, WAV).',
    };
  }
  
  // Disk space errors
  if (msg.includes('no space') || msg.includes('disk full') || msg.includes('enospc')) {
    return {
      title: 'Disk Full',
      description: 'There is not enough disk space to complete this operation.',
    };
  }
  
  // Permission errors
  if (msg.includes('permission denied') || msg.includes('eacces')) {
    return {
      title: 'Permission Denied',
      description: 'The application does not have permission to access a required file or folder.',
    };
  }
  
  // Vault path errors
  if (msg.includes('vault') && (msg.includes('not found') || msg.includes('does not exist'))) {
    return {
      title: 'Vault Not Found',
      description: 'The configured Obsidian vault path does not exist. Check your settings.',
      action: { label: 'Open Settings', href: '/settings' },
    };
  }
  
  // Timeout errors
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      title: 'Operation Timed Out',
      description: 'The operation took too long. This might happen with very long audio files or slow hardware.',
    };
  }
  
  // Generic network errors
  if (msg.includes('network') || msg.includes('fetch failed')) {
    return {
      title: 'Network Error',
      description: 'A network request failed. Check your internet connection and try again.',
    };
  }
  
  return null;
}

interface JobProgressProps {
  stage: JobStage;
  stageMessage?: string | null;
  errorMessage?: string | null;
  onCancel?: () => void;
  canCancel?: boolean;
}

const stageLabels: Record<JobStage, string> = {
  pending: 'Waiting to start',
  queued: 'In queue',
  normalizing: 'Converting audio',
  transcribing: 'Transcribing',
  awaiting_review: 'Ready for review',
  awaiting_prompts: 'Ready for prompts',
  generating: 'Generating journal',
  writing: 'Writing note',
  completed: 'Complete',
  failed: 'Failed',
  cancel_requested: 'Cancelling',
  cancelled: 'Cancelled',
};

const stages: JobStage[] = [
  'queued',
  'normalizing',
  'transcribing',
  'generating',
  'writing',
  'completed',
];

export function JobProgress({ 
  stage, 
  stageMessage, 
  errorMessage, 
  onCancel,
  canCancel = true,
}: JobProgressProps) {
  const progress = calculateOverallProgress(stage);
  const isProcessing = ['queued', 'normalizing', 'transcribing', 'generating', 'writing', 'cancel_requested'].includes(stage);
  const isComplete = stage === 'completed';
  const isFailed = stage === 'failed';
  const isCancelled = stage === 'cancelled';
  const isWaiting = stage === 'awaiting_review' || stage === 'awaiting_prompts';

  const getStageStatus = (s: JobStage): 'completed' | 'current' | 'pending' | 'skipped' => {
    const currentIndex = stages.indexOf(stage);
    const stageIndex = stages.indexOf(s);
    
    if (isFailed || isCancelled) {
      if (stageIndex < currentIndex) return 'completed';
      if (stageIndex === currentIndex) return 'current';
      return 'skipped';
    }
    
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">
              {stageLabels[stage] || stage}
            </span>
            <span className="text-sm text-muted-foreground">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stage indicators */}
        <div className="flex justify-between mb-6">
          {stages.filter(s => !['awaiting_review', 'awaiting_prompts'].includes(s)).map((s, index) => {
            const status = getStageStatus(s);
            return (
              <div key={s} className="flex flex-col items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  ${status === 'completed' ? 'bg-primary text-primary-foreground' : ''}
                  ${status === 'current' && isProcessing ? 'bg-primary/20 text-primary border-2 border-primary' : ''}
                  ${status === 'current' && !isProcessing ? 'bg-primary text-primary-foreground' : ''}
                  ${status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                  ${status === 'skipped' ? 'bg-muted text-muted-foreground opacity-50' : ''}
                `}>
                  {status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                  {status === 'current' && isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {status === 'current' && !isProcessing && <CheckCircle2 className="h-4 w-4" />}
                  {status === 'pending' && <span>{index + 1}</span>}
                  {status === 'skipped' && <span>{index + 1}</span>}
                </div>
                <span className="text-xs text-muted-foreground mt-1 text-center hidden sm:block">
                  {stageLabels[s].split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status message */}
        <div className="flex items-center justify-center gap-2 text-sm">
          {isProcessing && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{stageMessage || stageLabels[stage]}</span>
            </>
          )}
          
          {isComplete && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Journal entry created successfully</span>
            </>
          )}
          
          {isFailed && (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-destructive">{errorMessage || 'An error occurred'}</span>
              </div>
              
              {/* Actionable error help */}
              {(() => {
                const help = getErrorHelp(errorMessage, stage);
                if (!help) return null;
                
                return (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{help.title}</AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="mb-2">{help.description}</p>
                      {help.action && (
                        <div className="mt-3">
                          {help.action.href ? (
                            <a href={help.action.href}>
                              <Button size="sm" variant="outline">
                                {help.action.label}
                              </Button>
                            </a>
                          ) : help.action.command ? (
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-background/50 px-2 py-1 rounded font-mono">
                                {help.action.command}
                              </code>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}
            </div>
          )}
          
          {isCancelled && (
            <>
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Processing cancelled</span>
            </>
          )}
          
          {isWaiting && (
            <>
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600">
                {stage === 'awaiting_review' ? 'Review your transcript' : 'Review your answers'}
              </span>
            </>
          )}
        </div>

        {/* Cancel button */}
        {isProcessing && canCancel && onCancel && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { ChildProcess } from 'child_process';
import { nanoid } from 'nanoid';
import { 
  getEntry, 
  updateEntry, 
  getQueuedEntries, 
  getStuckEntries,
  resolveAudioPath,
  getAllSettings,
} from '@/lib/db';
import path from 'path';
import { normalizeAudio, deleteAudioFile } from '@/lib/services/audio';
import { transcribe, transcribeChunked } from '@/lib/services/transcribe';
import { generateJournal } from '@/lib/services/llm';
import { writeNote } from '@/lib/services/vault';
import type { JobStage, PromptAnswers, GeneratedSections } from '@/types';

// Runner instance ID for locking
const RUNNER_ID = `runner-${nanoid(8)}`;

// Track running child processes for cancellation
const childProcesses = new Map<string, ChildProcess>();

// Track if the runner loop is active
let runnerActive = false;
let runnerInterval: NodeJS.Timeout | null = null;

/**
 * Start the job runner loop
 * Checks for queued jobs and processes them
 */
export function startRunner(intervalMs = 1000): void {
  if (runnerActive) return;
  
  runnerActive = true;
  console.log('[JobRunner] Started');
  
  // Initial run
  processNextJob();
  
  // Set up interval
  runnerInterval = setInterval(() => {
    processNextJob();
  }, intervalMs);
}

/**
 * Stop the job runner loop
 */
export function stopRunner(): void {
  if (runnerInterval) {
    clearInterval(runnerInterval);
    runnerInterval = null;
  }
  runnerActive = false;
  console.log('[JobRunner] Stopped');
}

/**
 * Process the next queued job
 */
async function processNextJob(): Promise<void> {
  // Check for stuck jobs first and reset them
  const stuckJobs = getStuckEntries(5);
  for (const job of stuckJobs) {
    console.log(`[JobRunner] Resetting stuck job ${job.id} (was ${job.stage})`);
    updateEntry(job.id, {
      stage: 'queued',
      lockedBy: null,
      lockedAt: null,
      stageMessage: 'Reset after timeout',
    });
  }
  
  // Get next queued job
  const queuedJobs = getQueuedEntries();
  if (queuedJobs.length === 0) return;
  
  const job = queuedJobs[0];
  
  // Try to lock the job
  const locked = tryLockJob(job.id);
  if (!locked) return;
  
  // Process the job
  try {
    await runJob(job.id);
  } catch (err) {
    console.error(`[JobRunner] Job ${job.id} failed:`, err);
    updateEntry(job.id, {
      stage: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      lockedBy: null,
    });
  }
}

/**
 * Try to lock a job for processing
 */
function tryLockJob(entryId: string): boolean {
  const entry = getEntry(entryId);
  if (!entry || entry.stage !== 'queued') return false;
  if (entry.lockedBy && entry.lockedBy !== RUNNER_ID) return false;
  
  updateEntry(entryId, {
    lockedBy: RUNNER_ID,
    lockedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  });
  
  return true;
}

/**
 * Update heartbeat to prevent job from being considered stuck
 */
function updateHeartbeat(entryId: string): void {
  updateEntry(entryId, {
    heartbeatAt: new Date().toISOString(),
  });
}

/**
 * Check if job has been cancelled
 */
function isCancelled(entryId: string): boolean {
  const entry = getEntry(entryId);
  return entry?.stage === 'cancel_requested';
}

/**
 * Finalize cancellation
 */
async function finalizeCancellation(entryId: string): Promise<void> {
  const entry = getEntry(entryId);
  if (!entry) return;
  
  const settings = getAllSettings();
  
  // Clean up temp files
  if (entry.normalizedAudioRelpath && settings.vaultPath) {
    await deleteAudioFile(entry.normalizedAudioRelpath, settings.vaultPath);
  }
  
  updateEntry(entryId, {
    stage: 'cancelled',
    stageMessage: 'Cancelled by user',
    lockedBy: null,
  });
  
  console.log(`[JobRunner] Job ${entryId} cancelled`);
}

/**
 * Run a job through all stages
 */
async function runJob(entryId: string): Promise<void> {
  const entry = getEntry(entryId);
  if (!entry) throw new Error('Entry not found');
  
  const settings = getAllSettings();
  if (!settings.vaultPath) {
    throw new Error('Vault path not configured');
  }
  
  console.log(`[JobRunner] Starting job ${entryId} (${entry.entryType})`);
  
  // Stage: Normalizing
  if (await checkAndRunStage(entryId, 'normalizing', async () => {
    if (!entry.originalAudioRelpath) {
      throw new Error('No audio file uploaded');
    }
    
    const inputPath = resolveAudioPath(entry.originalAudioRelpath, settings.vaultPath!);
    const outputFilename = `${entryId}-normalized.wav`;
    
    const result = await normalizeAudio(inputPath, outputFilename, settings.vaultPath!, {
      onProcess: (proc) => childProcesses.set(entryId, proc),
    });
    
    childProcesses.delete(entryId);
    
    updateEntry(entryId, {
      normalizedAudioRelpath: result.relpath,
      audioDurationSeconds: result.duration,
    });
  })) return;
  
  // Stage: Transcribing
  if (await checkAndRunStage(entryId, 'transcribing', async () => {
    const currentEntry = getEntry(entryId)!;
    if (!currentEntry.normalizedAudioRelpath) {
      throw new Error('No normalized audio file');
    }
    
    const wavPath = resolveAudioPath(currentEntry.normalizedAudioRelpath, settings.vaultPath!);
    const audioDuration = currentEntry.audioDurationSeconds || 0;
    const chunkDuration = settings.chunkDurationSeconds || 60; // Default 60 seconds
    
    let result;
    if (audioDuration > chunkDuration) {
      // Use chunked transcription for long audio
      const tempDir = path.dirname(wavPath);
      console.log(`[JobRunner] Using chunked transcription for ${audioDuration.toFixed(1)}s audio (chunk size: ${chunkDuration}s)`);
      result = await transcribeChunked(wavPath, audioDuration, tempDir, {
        chunkDurationSeconds: chunkDuration,
        overlapSeconds: 5,
        onProcess: (proc) => childProcesses.set(entryId, proc),
      });
    } else {
      // Use regular transcription for short audio
      result = await transcribe(wavPath, {
        onProcess: (proc) => childProcesses.set(entryId, proc),
      });
    }
    
    childProcesses.delete(entryId);
    
    // Lock the raw transcript (immutable after this point)
    updateEntry(entryId, {
      rawTranscript: result.text,
      rawTranscriptLockedAt: new Date().toISOString(),
    });
  })) return;
  
  // All entry types: wait for user to review transcript before continuing
  updateEntry(entryId, {
    stage: 'awaiting_review',
    stageMessage: 'Waiting for transcript review',
    lockedBy: null,
  });
  console.log(`[JobRunner] Job ${entryId} awaiting review`);
  return;
}

/**
 * Continue job after user review (for daily-reflection) or automatically
 */
export async function continueJobAfterReview(entryId: string): Promise<void> {
  const entry = getEntry(entryId);
  if (!entry) throw new Error('Entry not found');
  
  // Lock the job again
  updateEntry(entryId, {
    lockedBy: RUNNER_ID,
    lockedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  });
  
  try {
    const transcript = entry.editedTranscript || entry.rawTranscript || '';
    
    // For quick-note: skip LLM processing, go straight to writing
    if (entry.entryType === 'quick-note') {
      await writeNoteAndComplete(entryId, transcript, {}, {});
      return;
    }
    
    // For brain-dump: skip extracting, go directly to generation
    if (entry.entryType === 'brain-dump') {
      await continueJobAfterPrompts(entryId);
      return;
    }
    
    // For daily-reflection: use existing extracting flow (prompt answers)
    let promptAnswers: PromptAnswers = {};
    
    if (entry.promptAnswers) {
      // User already provided/edited prompt answers
      promptAnswers = JSON.parse(entry.promptAnswers);
    }
    // Note: We no longer auto-extract - daily-reflection expects user to fill in prompts
    // If no promptAnswers provided, proceed with empty answers
    
    // For daily-reflection: wait for user to confirm/edit prompts
    updateEntry(entryId, {
      stage: 'awaiting_prompts',
      stageMessage: 'Waiting for prompt review',
      promptAnswers: JSON.stringify(promptAnswers),
      lockedBy: null,
    });
    console.log(`[JobRunner] Job ${entryId} awaiting prompts`);
    return;
    
  } catch (err) {
    console.error(`[JobRunner] Job ${entryId} failed during continuation:`, err);
    updateEntry(entryId, {
      stage: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      lockedBy: null,
    });
  }
}

/**
 * Continue job after user confirms prompts
 */
export async function continueJobAfterPrompts(entryId: string): Promise<void> {
  const entry = getEntry(entryId);
  if (!entry) throw new Error('Entry not found');
  
  // Lock the job
  updateEntry(entryId, {
    lockedBy: RUNNER_ID,
    lockedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
  });
  
  try {
    const transcript = entry.editedTranscript || entry.rawTranscript || '';
    const promptAnswers: PromptAnswers = entry.promptAnswers 
      ? JSON.parse(entry.promptAnswers) 
      : {};
    
    // Stage: Generating
    let generatedSections: GeneratedSections = {};
    
    if (await checkAndRunStage(entryId, 'generating', async () => {
      updateHeartbeat(entryId);
      const result = await generateJournal(transcript, promptAnswers, entry.entryType);
      
      // For brain-dump: store in JOURNAL section
      // For daily-reflection: store in AI_REFLECTION section
      if (entry.entryType === 'brain-dump') {
        generatedSections = {
          JOURNAL: result.content,
        };
      } else {
        generatedSections = {
          AI_REFLECTION: result.reflection,
          SUMMARY: result.summary,
        };
      }
      
      updateEntry(entryId, {
        generatedSections: JSON.stringify(generatedSections),
      });
    })) return;
    
    // Get latest generated sections
    const latestEntry = getEntry(entryId)!;
    if (latestEntry.generatedSections) {
      generatedSections = JSON.parse(latestEntry.generatedSections);
    }
    
    // Stage: Writing
    await writeNoteAndComplete(entryId, transcript, promptAnswers, generatedSections);
    
  } catch (err) {
    console.error(`[JobRunner] Job ${entryId} failed during generation:`, err);
    updateEntry(entryId, {
      stage: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      lockedBy: null,
    });
  }
}

/**
 * Write note and complete the job
 */
async function writeNoteAndComplete(
  entryId: string,
  transcript: string,
  promptAnswers: PromptAnswers,
  generatedSections: GeneratedSections
): Promise<void> {
  if (await checkAndRunStage(entryId, 'writing', async () => {
    updateHeartbeat(entryId);
    
    const entry = getEntry(entryId)!;
    const result = await writeNote(entry, transcript, promptAnswers, generatedSections);
    
    updateEntry(entryId, {
      noteRelpath: result.relpath,
      noteMtime: result.mtime,
    });
  })) return;
  
  // Clean up audio if configured
  const settings = getAllSettings();
  if (!settings.keepAudio && settings.vaultPath) {
    const entry = getEntry(entryId)!;
    if (entry.originalAudioRelpath) {
      await deleteAudioFile(entry.originalAudioRelpath, settings.vaultPath);
    }
    if (entry.normalizedAudioRelpath) {
      await deleteAudioFile(entry.normalizedAudioRelpath, settings.vaultPath);
    }
  }
  
  // Complete!
  updateEntry(entryId, {
    stage: 'completed',
    stageMessage: 'Journal entry created',
    lockedBy: null,
  });
  
  console.log(`[JobRunner] Job ${entryId} completed`);
}

/**
 * Helper to check cancellation and run a stage
 * Returns true if cancelled (should exit job)
 */
async function checkAndRunStage(
  entryId: string,
  stage: JobStage,
  fn: () => Promise<void>
): Promise<boolean> {
  // Check for cancellation before starting stage
  if (isCancelled(entryId)) {
    await finalizeCancellation(entryId);
    return true;
  }
  
  // Update stage
  updateEntry(entryId, {
    stage,
    stageMessage: getStageMessage(stage),
  });
  
  // Run the stage
  await fn();
  
  // Check for cancellation after stage
  if (isCancelled(entryId)) {
    await finalizeCancellation(entryId);
    return true;
  }
  
  return false;
}

/**
 * Get human-readable message for a stage
 */
function getStageMessage(stage: JobStage): string {
  const messages: Record<JobStage, string> = {
    pending: 'Waiting to start',
    queued: 'In queue',
    normalizing: 'Converting audio...',
    transcribing: 'Transcribing audio...',
    awaiting_review: 'Waiting for review',
    awaiting_prompts: 'Waiting for prompts',
    generating: 'Generating journal...',
    writing: 'Writing note...',
    completed: 'Complete',
    failed: 'Failed',
    cancel_requested: 'Cancelling...',
    cancelled: 'Cancelled',
  };
  return messages[stage] || stage;
}

/**
 * Request cancellation of a running job
 */
export function requestCancel(entryId: string): boolean {
  const entry = getEntry(entryId);
  if (!entry) return false;
  
  // Can only cancel jobs that are actually running
  const cancellableStages: JobStage[] = [
    'queued', 'normalizing', 'transcribing', 'generating', 'writing'
  ];
  
  if (!cancellableStages.includes(entry.stage)) {
    return false;
  }
  
  // Mark as cancel requested
  updateEntry(entryId, {
    stage: 'cancel_requested',
    stageMessage: 'Cancellation requested',
  });
  
  // Kill child process if running
  const childProc = childProcesses.get(entryId);
  if (childProc && !childProc.killed) {
    childProc.kill('SIGTERM');
    childProcesses.delete(entryId);
  }
  
  console.log(`[JobRunner] Cancellation requested for ${entryId}`);
  return true;
}

/**
 * Queue an entry for processing
 */
export function queueEntry(entryId: string): void {
  const entry = getEntry(entryId);
  if (!entry) throw new Error('Entry not found');
  
  if (entry.stage !== 'pending') {
    throw new Error(`Cannot queue entry in stage ${entry.stage}`);
  }
  
  updateEntry(entryId, {
    stage: 'queued',
    stageMessage: 'Queued for processing',
  });
  
  console.log(`[JobRunner] Entry ${entryId} queued`);
}

// Export runner ID for testing
export { RUNNER_ID };

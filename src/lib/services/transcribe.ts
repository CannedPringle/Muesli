import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getSetting } from '@/lib/db';
import { splitAudio, cleanupChunks } from '@/lib/services/audio';

export interface TranscribeOptions {
  onProcess?: (proc: ChildProcess) => void;
  language?: string;
}

export interface TranscribeResult {
  text: string;
}

/**
 * Default whisper binary and model paths
 */
const DEFAULT_WHISPER_PATH = path.join(process.env.HOME || '', '.whisper', 'whisper');
const DEFAULT_MODEL_DIR = path.join(process.env.HOME || '', '.whisper', 'models');

/**
 * Get the whisper binary path
 */
function getWhisperPath(): string {
  // Check if whisper.cpp main binary exists
  const defaultPath = DEFAULT_WHISPER_PATH;
  return defaultPath;
}

/**
 * Get the model path
 */
function getModelPath(): string {
  const customPath = getSetting('whisper_model_path');
  if (customPath) return customPath;
  
  const modelName = getSetting('whisper_model_name') || 'small';
  return path.join(DEFAULT_MODEL_DIR, `ggml-${modelName}.bin`);
}

/**
 * Transcribe audio file using whisper.cpp
 */
export async function transcribe(
  wavPath: string,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const whisperPath = getWhisperPath();
  const modelPath = getModelPath();

  // Verify files exist
  try {
    await fs.access(whisperPath);
  } catch {
    throw new Error(
      `Whisper binary not found at ${whisperPath}. Run: npm run setup:whisper`
    );
  }

  try {
    await fs.access(modelPath);
  } catch {
    throw new Error(
      `Whisper model not found at ${modelPath}. Run: npm run setup:whisper`
    );
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-l', options.language || 'auto',
      '--no-timestamps',
      '-t', '8',              // Use 8 threads (M1 has 8 cores)
      '-bs', '5',             // Beam size for search
      '-bo', '5',             // Best-of candidates
      '-et', '2.4',           // Default entropy threshold
      '-mc', '0',             // Fresh context each segment (prevents context corruption)
      '--no-fallback',        // Disable temperature fallback (prevents hallucination loops)
      '-otxt',                // Output as text
      '-of', wavPath,         // Output file prefix (will create wavPath.txt)
    ];

    // Add custom vocabulary prompt if configured
    const whisperPrompt = getSetting('whisper_prompt');
    if (whisperPrompt) {
      args.push('--prompt', whisperPrompt);
      args.push('--carry-initial-prompt');
    }

    // Add VAD (Voice Activity Detection) if enabled
    const vadEnabled = getSetting('vad_enabled') === 'true';
    const vadModelPath = getSetting('vad_model_path');
    
    if (vadEnabled && vadModelPath) {
      try {
        // Check if VAD model exists synchronously for this sync context
        // We'll verify asynchronously before getting here in practice
        args.push('--vad');
        args.push('-vm', vadModelPath);
        args.push('-vt', '0.5');           // VAD threshold (0.0-1.0)
        args.push('-vspd', '250');         // Min speech duration ms
        args.push('-vsd', '100');          // Min silence duration ms
      } catch {
        console.warn('[Transcribe] VAD enabled but model not accessible, skipping VAD');
      }
    }

    const whisper = spawn(whisperPath, args);

    // Allow caller to track the process for cancellation
    if (options.onProcess) {
      options.onProcess(whisper);
    }

    let stderr = '';
    whisper.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      // Log progress (whisper.cpp outputs progress to stderr)
      // Could parse this for progress updates
    });

    whisper.on('close', async (code) => {
      if (code === 0) {
        // Read the output text file
        const outputFile = `${wavPath}.txt`;
        try {
          const text = await fs.readFile(outputFile, 'utf-8');
          // Clean up output file
          await fs.unlink(outputFile).catch(() => {});
          resolve({ text: text.trim() });
        } catch (err) {
          reject(new Error(`Failed to read transcription output: ${err}`));
        }
      } else {
        reject(new Error(`whisper.cpp failed with code ${code}: ${stderr}`));
      }
    });

    whisper.on('error', (err) => {
      reject(new Error(`whisper.cpp spawn error: ${err.message}`));
    });
  });
}

// ============================================
// Hallucination Detection
// ============================================

interface HallucinationCheck {
  isHallucination: boolean;
  reason?: string;
  confidence: number; // 0-1
}

/**
 * Detect if transcription output shows signs of hallucination
 * Common patterns: repeated phrases, gibberish, output too short
 */
function detectHallucination(text: string, expectedDurationSeconds: number): HallucinationCheck {
  if (!text || text.trim().length === 0) {
    return {
      isHallucination: true,
      reason: 'Empty output',
      confidence: 1.0
    };
  }

  // Check 1: Text too short for duration (~5 chars/sec minimum for speech)
  const minExpectedChars = expectedDurationSeconds * 5;
  if (text.length < minExpectedChars * 0.3) {
    return {
      isHallucination: true,
      reason: `Output too short: ${text.length} chars for ${expectedDurationSeconds.toFixed(0)}s audio (expected ~${minExpectedChars.toFixed(0)})`,
      confidence: 0.8
    };
  }

  // Check 2: Repeated phrases (5+ words repeating 3+ times consecutively)
  const words = text.split(/\s+/);
  for (let phraseLen = 5; phraseLen <= 12; phraseLen++) {
    if (words.length < phraseLen * 3) continue;
    
    for (let i = 0; i <= words.length - phraseLen * 3; i++) {
      const phrase = words.slice(i, i + phraseLen).join(' ').toLowerCase();
      let repeatCount = 1;
      let pos = i + phraseLen;
      
      while (pos + phraseLen <= words.length) {
        const nextPhrase = words.slice(pos, pos + phraseLen).join(' ').toLowerCase();
        if (nextPhrase === phrase) {
          repeatCount++;
          pos += phraseLen;
        } else {
          break;
        }
      }
      
      if (repeatCount >= 3) {
        return {
          isHallucination: true,
          reason: `Phrase repeated ${repeatCount} times: "${phrase.slice(0, 50)}${phrase.length > 50 ? '...' : ''}"`,
          confidence: 0.95
        };
      }
    }
  }

  // Check 3: High ratio of repeated words (sign of looping)
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    const normalized = word.toLowerCase().replace(/[^\w]/g, '');
    if (normalized.length > 2) {
      wordCounts.set(normalized, (wordCounts.get(normalized) || 0) + 1);
    }
  }
  
  // If any single word appears more than 20% of total words, suspicious
  const totalWords = words.length;
  for (const [word, count] of wordCounts) {
    if (count > totalWords * 0.2 && count > 10) {
      return {
        isHallucination: true,
        reason: `Word "${word}" repeated ${count} times (${((count / totalWords) * 100).toFixed(0)}% of text)`,
        confidence: 0.7
      };
    }
  }

  return { isHallucination: false, confidence: 0 };
}

// ============================================
// Conservative Transcription (for retry)
// ============================================

/**
 * Transcribe with more conservative settings
 * Used when hallucination is detected in initial transcription
 */
async function transcribeConservative(
  wavPath: string,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const whisperPath = getWhisperPath();
  const modelPath = getModelPath();

  // Verify files exist
  try {
    await fs.access(whisperPath);
  } catch {
    throw new Error(`Whisper binary not found at ${whisperPath}`);
  }

  try {
    await fs.access(modelPath);
  } catch {
    throw new Error(`Whisper model not found at ${modelPath}`);
  }

  const retryOutputPrefix = wavPath + '.retry';

  return new Promise((resolve, reject) => {
    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-l', options.language || 'auto',
      '--no-timestamps',
      '-t', '4',              // Fewer threads (less memory pressure)
      '-bs', '3',             // Smaller beam size
      '-bo', '3',             // Fewer candidates
      '-tp', '0.0',           // Zero temperature (most deterministic)
      '-et', '2.4',           // Default entropy threshold
      '-mc', '0',             // Fresh context each segment
      '--no-fallback',        // No temperature fallback
      '-otxt',
      '-of', retryOutputPrefix,
    ];

    // Add VAD if available (helps filter non-speech)
    const vadEnabled = getSetting('vad_enabled') === 'true';
    const vadModelPath = getSetting('vad_model_path');
    
    if (vadEnabled && vadModelPath) {
      args.push('--vad');
      args.push('-vm', vadModelPath);
      args.push('-vt', '0.6');  // Slightly higher threshold for conservative mode
    }

    const whisper = spawn(whisperPath, args);

    let stderr = '';
    whisper.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    whisper.on('close', async (code) => {
      if (code === 0) {
        const outputFile = `${retryOutputPrefix}.txt`;
        try {
          const text = await fs.readFile(outputFile, 'utf-8');
          await fs.unlink(outputFile).catch(() => {});
          resolve({ text: text.trim() });
        } catch (err) {
          reject(new Error(`Failed to read retry transcription output: ${err}`));
        }
      } else {
        reject(new Error(`whisper.cpp retry failed with code ${code}: ${stderr}`));
      }
    });

    whisper.on('error', (err) => {
      reject(new Error(`whisper.cpp retry spawn error: ${err.message}`));
    });
  });
}

// ============================================
// Chunked transcription for long audio
// ============================================

export interface TranscribeChunkedOptions extends TranscribeOptions {
  chunkDurationSeconds?: number;  // Default: 60 (1 minute)
  overlapSeconds?: number;        // Default: 5
}

/** Chunk transcript with potential alternative from retry */
interface ChunkTranscript {
  text: string;
  alternativeText?: string;  // From retry if hallucination detected
  hadHallucination: boolean;
  hallucinationReason?: string;
}

/**
 * Transcribe long audio by splitting into chunks
 * Automatically handles chunk overlap and merges results
 * Detects hallucinations and retries with conservative settings
 * 
 * @param wavPath - Path to the normalized WAV file
 * @param audioDuration - Duration of audio in seconds
 * @param tempDir - Directory for temporary chunk files
 * @param options - Transcription options
 * @returns Combined transcription result (includes alternatives if hallucination detected)
 */
export async function transcribeChunked(
  wavPath: string,
  audioDuration: number,
  tempDir: string,
  options: TranscribeChunkedOptions = {}
): Promise<TranscribeResult> {
  const chunkDuration = options.chunkDurationSeconds ?? 60; // 1 minute default
  const overlapSeconds = options.overlapSeconds ?? 5;
  
  // If audio is short enough, use regular transcription
  if (audioDuration <= chunkDuration) {
    return transcribe(wavPath, options);
  }
  
  console.log(`[Transcribe] Audio is ${audioDuration.toFixed(1)}s, splitting into ${chunkDuration}s chunks`);
  
  // Split audio into chunks
  const chunks = await splitAudio(wavPath, tempDir, {
    chunkDurationSeconds: chunkDuration,
    overlapSeconds,
  });
  
  console.log(`[Transcribe] Created ${chunks.length} chunks`);
  
  try {
    // Transcribe each chunk sequentially (to avoid memory pressure)
    const chunkResults: ChunkTranscript[] = [];
    let totalHallucinations = 0;
    
    for (const chunk of chunks) {
      const chunkDurationSecs = chunk.endTime - chunk.startTime;
      console.log(`[Transcribe] Processing chunk ${chunk.index + 1}/${chunks.length} (${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s)`);
      
      // Initial transcription
      const result = await transcribe(chunk.path, {
        ...options,
        onProcess: undefined,
      });
      
      // Log chunk stats
      const wordCount = result.text.split(/\s+/).filter(w => w.length > 0).length;
      console.log(`[Transcribe] Chunk ${chunk.index + 1}: ${result.text.length} chars, ${wordCount} words`);
      
      // Check for hallucination
      const hallCheck = detectHallucination(result.text, chunkDurationSecs);
      
      const chunkResult: ChunkTranscript = {
        text: result.text,
        hadHallucination: hallCheck.isHallucination,
        hallucinationReason: hallCheck.reason,
      };
      
      if (hallCheck.isHallucination) {
        totalHallucinations++;
        console.warn(`[Transcribe] Hallucination detected in chunk ${chunk.index + 1}: ${hallCheck.reason}`);
        console.log(`[Transcribe] Retrying chunk ${chunk.index + 1} with conservative settings...`);
        
        try {
          // Retry with conservative settings
          const retryResult = await transcribeConservative(chunk.path, options);
          const retryWordCount = retryResult.text.split(/\s+/).filter(w => w.length > 0).length;
          console.log(`[Transcribe] Retry chunk ${chunk.index + 1}: ${retryResult.text.length} chars, ${retryWordCount} words`);
          
          // Check if retry is also hallucinated
          const retryCheck = detectHallucination(retryResult.text, chunkDurationSecs);
          
          if (retryCheck.isHallucination) {
            console.warn(`[Transcribe] Retry also shows hallucination: ${retryCheck.reason}`);
            // Keep both versions for user to choose
            chunkResult.alternativeText = retryResult.text;
          } else {
            // Retry is better, use it as primary but keep original as alternative
            console.log(`[Transcribe] Retry succeeded, using retry as primary`);
            chunkResult.alternativeText = chunkResult.text;
            chunkResult.text = retryResult.text;
          }
        } catch (retryErr) {
          console.warn(`[Transcribe] Retry failed: ${retryErr}`);
          // Keep original despite hallucination
        }
      }
      
      chunkResults.push(chunkResult);
    }
    
    // Merge primary transcripts
    const primaryTranscripts = chunkResults.map(c => c.text);
    const mergedText = mergeTranscripts(primaryTranscripts, overlapSeconds);
    
    console.log(`[Transcribe] Merged ${chunks.length} chunks into ${mergedText.length} characters`);
    
    // If there were hallucinations, also merge alternatives and include in output
    if (totalHallucinations > 0) {
      console.warn(`[Transcribe] ${totalHallucinations} chunk(s) had hallucinations. Alternatives included in output.`);
      
      // Build alternative text showing where issues occurred
      const alternativeTranscripts = chunkResults.map((c, i) => {
        if (c.alternativeText) {
          return `[CHUNK ${i + 1} ALTERNATIVE - ${c.hallucinationReason}]\n${c.alternativeText}`;
        }
        return c.text;
      });
      const alternativeMerged = mergeTranscripts(
        alternativeTranscripts.filter(t => !t.startsWith('[CHUNK')),
        overlapSeconds
      );
      
      // Include alternatives in a way the user can see
      const chunksWithIssues = chunkResults
        .map((c, i) => c.hadHallucination ? i + 1 : null)
        .filter(Boolean);
      
      const outputWithNote = [
        mergedText,
        '',
        `---`,
        `[TRANSCRIPTION NOTE: Potential issues detected in chunk(s) ${chunksWithIssues.join(', ')}. Review carefully.]`,
        '',
        `[ALTERNATIVE TRANSCRIPTION:]`,
        alternativeMerged !== mergedText ? alternativeMerged : '(Same as above)',
      ].join('\n');
      
      return { text: outputWithNote };
    }
    
    return { text: mergedText };
    
  } finally {
    // Clean up chunk files
    await cleanupChunks(chunks, wavPath);
  }
}

/**
 * Merge transcripts from chunks, handling overlap regions
 * Uses word-based comparison to find and remove duplicates at boundaries
 */
function mergeTranscripts(transcripts: string[], overlapSeconds: number): string {
  if (transcripts.length === 0) return '';
  if (transcripts.length === 1) return transcripts[0];
  
  // Estimate words in overlap region (assuming ~2.5 words/second for speech)
  const wordsInOverlap = Math.ceil(overlapSeconds * 2.5);
  
  const merged: string[] = [];
  
  for (let i = 0; i < transcripts.length; i++) {
    const currentText = transcripts[i].trim();
    
    if (i === 0) {
      // First chunk: add everything
      merged.push(currentText);
      continue;
    }
    
    // For subsequent chunks, try to find and skip the overlapping part
    const prevText = merged.join(' ');
    const prevWords = prevText.split(/\s+/);
    const currentWords = currentText.split(/\s+/);
    
    // Get the last N words from previous text
    const prevTail = prevWords.slice(-wordsInOverlap * 2).map(w => normalizeWord(w));
    
    // Find best overlap match in the beginning of current text
    let bestOverlapIndex = 0;
    let bestMatchLength = 0;
    
    // Look for overlap in first portion of current chunk
    const searchLimit = Math.min(currentWords.length, wordsInOverlap * 3);
    
    for (let start = 0; start < searchLimit; start++) {
      const matchLength = countMatchingWords(
        prevTail,
        currentWords.slice(start, start + wordsInOverlap).map(w => normalizeWord(w))
      );
      
      if (matchLength > bestMatchLength) {
        bestMatchLength = matchLength;
        bestOverlapIndex = start + matchLength;
      }
    }
    
    // If we found a good overlap (at least 2 matching words), skip it
    if (bestMatchLength >= 2) {
      const nonOverlappingPart = currentWords.slice(bestOverlapIndex).join(' ');
      if (nonOverlappingPart.trim()) {
        merged.push(nonOverlappingPart);
      }
    } else {
      // No good overlap found, just append with a space
      merged.push(currentText);
    }
  }
  
  return merged.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a word for comparison (lowercase, remove punctuation)
 */
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^\w]/g, '');
}

/**
 * Count how many words match between two arrays
 */
function countMatchingWords(arr1: string[], arr2: string[]): number {
  let matches = 0;
  const minLen = Math.min(arr1.length, arr2.length);
  
  for (let i = 0; i < minLen; i++) {
    // Compare from the end of arr1 with the start of arr2
    const idx1 = arr1.length - minLen + i;
    if (arr1[idx1] === arr2[i]) {
      matches++;
    }
  }
  
  return matches;
}

/**
 * Check if whisper.cpp is installed and model exists
 */
export async function checkWhisper(): Promise<{
  installed: boolean;
  modelExists: boolean;
  whisperPath: string;
  modelPath: string;
  modelName: string;
  error?: string;
}> {
  const whisperPath = getWhisperPath();
  const modelPath = getModelPath();
  const modelName = getSetting('whisper_model_name') || 'small';

  let installed = false;
  let modelExists = false;
  let error: string | undefined;

  try {
    await fs.access(whisperPath);
    installed = true;
  } catch {
    error = `Whisper binary not found at ${whisperPath}`;
  }

  try {
    await fs.access(modelPath);
    modelExists = true;
  } catch {
    if (!error) {
      error = `Whisper model "${modelName}" not found at ${modelPath}`;
    }
  }

  return {
    installed,
    modelExists,
    whisperPath,
    modelPath,
    modelName,
    error: installed && modelExists ? undefined : error,
  };
}

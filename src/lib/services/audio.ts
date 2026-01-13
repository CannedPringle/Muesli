import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getAudioDir, resolveAudioPath } from '@/lib/db';

export interface NormalizeResult {
  outputPath: string;
  relpath: string;
  duration: number;
}

export interface NormalizeOptions {
  onProcess?: (proc: ChildProcess) => void;
}

/**
 * Normalize audio to 16kHz mono WAV for whisper.cpp
 * Uses ffmpeg CLI
 * Saves to {vaultPath}/journal/audio/
 */
export async function normalizeAudio(
  inputPath: string,
  outputFilename: string,
  vaultPath: string,
  options: NormalizeOptions = {}
): Promise<NormalizeResult> {
  const audioDir = getAudioDir(vaultPath);
  const outputPath = path.join(audioDir, outputFilename);
  const relpath = path.join('journal', 'audio', outputFilename);

  // Get duration first
  const duration = await getAudioDuration(inputPath);

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ar', '16000',        // 16kHz sample rate
      '-ac', '1',            // Mono
      '-c:a', 'pcm_s16le',   // 16-bit PCM
      '-y',                  // Overwrite output
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);
    
    // Allow caller to track the process for cancellation
    if (options.onProcess) {
      options.onProcess(ffmpeg);
    }

    let stderr = '';
    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({ outputPath, relpath, duration });
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Save original audio file to vault
 * Saves to {vaultPath}/journal/audio/
 */
export async function saveOriginalAudio(
  inputPath: string,
  outputFilename: string,
  vaultPath: string
): Promise<{ outputPath: string; relpath: string }> {
  const audioDir = getAudioDir(vaultPath);
  const outputPath = path.join(audioDir, outputFilename);
  const relpath = path.join('journal', 'audio', outputFilename);

  await fs.copyFile(inputPath, outputPath);

  return { outputPath, relpath };
}

/**
 * Get audio duration in seconds using ffprobe
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ];

    const ffprobe = spawn('ffprobe', args);
    
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());
        if (isNaN(duration)) {
          reject(new Error('Could not parse duration'));
        } else {
          resolve(duration);
        }
      } else {
        reject(new Error(`ffprobe failed: ${stderr}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`ffprobe spawn error: ${err.message}`));
    });
  });
}

/**
 * Check if ffmpeg is installed
 */
export async function checkFfmpeg(): Promise<{ installed: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    
    let stdout = '';
    ffmpeg.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Extract version from first line
        const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
        resolve({
          installed: true,
          version: versionMatch ? versionMatch[1] : 'unknown'
        });
      } else {
        resolve({
          installed: false,
          error: 'ffmpeg exited with non-zero code'
        });
      }
    });

    ffmpeg.on('error', () => {
      resolve({
        installed: false,
        error: 'ffmpeg not found. Install with: brew install ffmpeg'
      });
    });
  });
}

/**
 * Delete audio file from vault
 */
export async function deleteAudioFile(relpath: string, vaultPath: string): Promise<void> {
  const fullPath = resolveAudioPath(relpath, vaultPath);
  
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    // Ignore if file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

// ============================================
// Audio chunking for long files
// ============================================

export interface AudioChunk {
  path: string;
  index: number;
  startTime: number;  // in seconds
  endTime: number;    // in seconds
}

export interface SplitOptions {
  chunkDurationSeconds?: number;  // Default: 150 (2.5 minutes)
  overlapSeconds?: number;        // Default: 5
  onProcess?: (proc: ChildProcess) => void;
}

/**
 * Split audio into chunks for processing long files
 * Uses ffmpeg to create overlapping segments
 * 
 * @param inputPath - Path to the input WAV file
 * @param outputDir - Directory to write chunk files
 * @param options - Chunking options
 * @returns Array of AudioChunk with metadata
 */
export async function splitAudio(
  inputPath: string,
  outputDir: string,
  options: SplitOptions = {}
): Promise<AudioChunk[]> {
  const chunkDuration = options.chunkDurationSeconds ?? 150; // 2.5 minutes
  const overlap = options.overlapSeconds ?? 5;
  
  // Get total duration
  const totalDuration = await getAudioDuration(inputPath);
  
  // If audio is shorter than chunk duration, no need to split
  if (totalDuration <= chunkDuration) {
    return [{
      path: inputPath,
      index: 0,
      startTime: 0,
      endTime: totalDuration,
    }];
  }
  
  const chunks: AudioChunk[] = [];
  const step = chunkDuration - overlap; // How much to advance each chunk
  let startTime = 0;
  let index = 0;
  
  while (startTime < totalDuration) {
    // Calculate end time (with overlap into next chunk)
    const endTime = Math.min(startTime + chunkDuration, totalDuration);
    const duration = endTime - startTime;
    
    // Generate output path
    const chunkFilename = `chunk_${String(index).padStart(3, '0')}.wav`;
    const chunkPath = path.join(outputDir, chunkFilename);
    
    // Extract chunk using ffmpeg
    await extractChunk(inputPath, chunkPath, startTime, duration, options.onProcess);
    
    chunks.push({
      path: chunkPath,
      index,
      startTime,
      endTime,
    });
    
    // Move to next chunk
    startTime += step;
    index++;
    
    // Safety check to prevent infinite loops
    if (index > 100) {
      throw new Error('Too many chunks generated, possible infinite loop');
    }
  }
  
  return chunks;
}

/**
 * Extract a single chunk from audio file using ffmpeg
 */
async function extractChunk(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  onProcess?: (proc: ChildProcess) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ss', String(startTime),     // Start time
      '-t', String(duration),       // Duration
      '-c:a', 'pcm_s16le',          // Keep same format
      '-ar', '16000',               // Keep same sample rate
      '-ac', '1',                   // Keep mono
      '-y',                         // Overwrite output
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);
    
    if (onProcess) {
      onProcess(ffmpeg);
    }

    let stderr = '';
    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg chunk extraction failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * Clean up chunk files after transcription
 */
export async function cleanupChunks(chunks: AudioChunk[], originalPath: string): Promise<void> {
  for (const chunk of chunks) {
    // Don't delete the original file if it was returned as a single "chunk"
    if (chunk.path !== originalPath) {
      try {
        await fs.unlink(chunk.path);
      } catch {
        // Ignore errors during cleanup
      }
    }
  }
}

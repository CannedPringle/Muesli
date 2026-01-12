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

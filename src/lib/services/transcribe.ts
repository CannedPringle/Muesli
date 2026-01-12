import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getSetting } from '@/lib/db';

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
      '-otxt',              // Output as text
      '-of', wavPath,       // Output file prefix (will create wavPath.txt)
    ];

    // Add custom vocabulary prompt if configured
    const whisperPrompt = getSetting('whisper_prompt');
    if (whisperPrompt) {
      args.push('--prompt', whisperPrompt);
      args.push('--carry-initial-prompt');
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

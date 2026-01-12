import { NextResponse } from 'next/server';
import { checkFfmpeg } from '@/lib/services/audio';
import { checkWhisper } from '@/lib/services/transcribe';
import { checkOllama } from '@/lib/services/llm';
import type { PrerequisitesCheck } from '@/types';

/**
 * GET /api/prerequisites - Check if all required tools are installed
 */
export async function GET() {
  try {
    // Check all prerequisites in parallel
    const [ffmpegResult, whisperResult, ollamaResult] = await Promise.all([
      checkFfmpeg(),
      checkWhisper(),
      checkOllama(),
    ]);
    
    // Build whisper install command with specific model name
    const whisperInstallCommand = whisperResult.modelExists 
      ? 'npm run setup:whisper'
      : `npm run setup:whisper:${whisperResult.modelName}`;
    
    const result: PrerequisitesCheck = {
      ffmpeg: {
        name: 'ffmpeg',
        installed: ffmpegResult.installed,
        version: ffmpegResult.version,
        error: ffmpegResult.error,
        installCommand: 'brew install ffmpeg',
      },
      whisper: {
        name: 'whisper.cpp',
        installed: whisperResult.installed && whisperResult.modelExists,
        version: whisperResult.modelExists ? `Model: ${whisperResult.modelName}` : undefined,
        error: whisperResult.error,
        installCommand: whisperInstallCommand,
      },
      ollama: {
        name: 'Ollama',
        installed: ollamaResult.running && ollamaResult.modelAvailable,
        version: ollamaResult.foundModel ? `Model: ${ollamaResult.foundModel}` : undefined,
        error: ollamaResult.error,
        installCommand: ollamaResult.running 
          ? 'ollama pull gpt-oss:20b'
          : 'Visit https://ollama.ai to install Ollama',
      },
      allReady: ffmpegResult.installed && 
                whisperResult.installed && 
                whisperResult.modelExists && 
                ollamaResult.running && 
                ollamaResult.modelAvailable,
    };
    
    return NextResponse.json(result);
    
  } catch (err) {
    console.error('Error checking prerequisites:', err);
    return NextResponse.json(
      { error: 'Failed to check prerequisites' },
      { status: 500 }
    );
  }
}

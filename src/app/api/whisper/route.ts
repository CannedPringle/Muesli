import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getSetting } from '@/lib/db';

const DEFAULT_MODEL_DIR = path.join(process.env.HOME || '', '.whisper', 'models');

const WHISPER_MODELS = [
  { name: 'tiny', size: '~75MB' },
  { name: 'base', size: '~150MB' },
  { name: 'small', size: '~500MB' },
  { name: 'medium', size: '~1.5GB' },
  { name: 'large-v3', size: '~3GB' },
];

export interface WhisperModelInfo {
  name: string;
  size: string;
  installed: boolean;
  path: string;
}

export interface WhisperModelsResponse {
  models: WhisperModelInfo[];
  selectedModel: string;
  selectedModelInstalled: boolean;
  modelsDir: string;
}

/**
 * GET /api/whisper - Check installed whisper models
 */
export async function GET() {
  try {
    const selectedModel = getSetting('whisper_model_name') || 'small';
    
    // Check which models are installed
    const models: WhisperModelInfo[] = await Promise.all(
      WHISPER_MODELS.map(async (model) => {
        const modelPath = path.join(DEFAULT_MODEL_DIR, `ggml-${model.name}.bin`);
        let installed = false;
        
        try {
          await fs.access(modelPath);
          installed = true;
        } catch {
          // Model not installed
        }
        
        return {
          name: model.name,
          size: model.size,
          installed,
          path: modelPath,
        };
      })
    );
    
    const selectedModelInfo = models.find(m => m.name === selectedModel);
    
    const response: WhisperModelsResponse = {
      models,
      selectedModel,
      selectedModelInstalled: selectedModelInfo?.installed ?? false,
      modelsDir: DEFAULT_MODEL_DIR,
    };
    
    return NextResponse.json(response);
  } catch (err) {
    console.error('Error checking whisper models:', err);
    return NextResponse.json(
      { error: 'Failed to check whisper models' },
      { status: 500 }
    );
  }
}

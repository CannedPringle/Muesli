import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';
import type { SettingKey } from '@/types';

/**
 * GET /api/settings - Get all settings
 */
export async function GET() {
  try {
    const settings = getAllSettings();
    
    return NextResponse.json(settings);
    
  } catch (err) {
    console.error('Error getting settings:', err);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings - Update settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Map camelCase to snake_case keys
    const keyMap: Record<string, SettingKey> = {
      vaultPath: 'vault_path',
      whisperModelPath: 'whisper_model_path',
      whisperModelName: 'whisper_model_name',
      whisperPrompt: 'whisper_prompt',
      ollamaBaseUrl: 'ollama_base_url',
      ollamaModel: 'ollama_model',
      keepAudio: 'keep_audio',
      defaultTimezone: 'default_timezone',
      userName: 'user_name',
    };
    
    // Update each provided setting
    for (const [camelKey, value] of Object.entries(body)) {
      const snakeKey = keyMap[camelKey];
      if (snakeKey && value !== undefined) {
        // Convert boolean to string for storage
        const stringValue = typeof value === 'boolean' ? String(value) : String(value);
        setSetting(snakeKey, stringValue);
      }
    }
    
    // Return updated settings
    const settings = getAllSettings();
    
    return NextResponse.json(settings);
    
  } catch (err) {
    console.error('Error updating settings:', err);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

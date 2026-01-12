import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getEntry, getAllSettings, resolveNotePath } from '@/lib/db';
import { getObsidianUri } from '@/lib/services/vault';

const execAsync = promisify(exec);

/**
 * POST /api/open-note - Open note in Obsidian or reveal in Finder
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, action } = body as { 
      entryId: string; 
      action: 'obsidian' | 'finder' 
    };
    
    if (!entryId || !action) {
      return NextResponse.json(
        { error: 'Missing entryId or action' },
        { status: 400 }
      );
    }
    
    const entry = getEntry(entryId);
    if (!entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }
    
    if (!entry.noteRelpath) {
      return NextResponse.json(
        { error: 'Note not yet created' },
        { status: 400 }
      );
    }
    
    const settings = getAllSettings();
    if (!settings.vaultPath) {
      return NextResponse.json(
        { error: 'Vault path not configured' },
        { status: 400 }
      );
    }
    
    const fullPath = resolveNotePath(entry.noteRelpath, settings.vaultPath);
    
    if (action === 'obsidian') {
      // Open in Obsidian using URI scheme
      const uri = getObsidianUri(settings.vaultPath, entry.noteRelpath);
      await execAsync(`open "${uri}"`);
      
      return NextResponse.json({
        success: true,
        message: 'Opened in Obsidian',
        uri,
      });
      
    } else if (action === 'finder') {
      // Reveal in Finder
      await execAsync(`open -R "${fullPath}"`);
      
      return NextResponse.json({
        success: true,
        message: 'Revealed in Finder',
        path: fullPath,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (err) {
    console.error('Error opening note:', err);
    return NextResponse.json(
      { error: 'Failed to open note' },
      { status: 500 }
    );
  }
}

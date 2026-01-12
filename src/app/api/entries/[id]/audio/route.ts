import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { getEntry, updateEntry, getAudioDir } from '@/lib/db';
import { queueEntry } from '@/lib/job-runner';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/audio - Upload audio file for entry
 * This starts the processing job
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const entry = getEntry(id);
    
    if (!entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }
    
    // Can only upload audio in pending stage
    if (entry.stage !== 'pending') {
      return NextResponse.json(
        { error: `Cannot upload audio in stage ${entry.stage}` },
        { status: 400 }
      );
    }
    
    // Get form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = [
      'audio/webm',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/wav',
      'audio/wave',
      'audio/ogg',
      'audio/flac',
    ];
    
    if (!allowedTypes.some(type => audioFile.type.startsWith(type.split('/')[0]))) {
      // Be lenient - just check it's audio
      if (!audioFile.type.startsWith('audio/')) {
        return NextResponse.json(
          { error: `Invalid file type: ${audioFile.type}. Expected audio file.` },
          { status: 400 }
        );
      }
    }
    
    // Generate filename with original extension
    const ext = path.extname(audioFile.name) || '.webm';
    const filename = `${id}-original${ext}`;
    const audioDir = getAudioDir();
    const filePath = path.join(audioDir, filename);
    
    // Write file to disk
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    await writeFile(filePath, buffer);
    
    // Update entry with audio path
    updateEntry(id, {
      originalAudioRelpath: filename,
    });
    
    // Queue for processing
    queueEntry(id);
    
    // Get updated entry
    const updatedEntry = getEntry(id);
    
    return NextResponse.json({
      success: true,
      entry: updatedEntry,
      message: 'Audio uploaded and queued for processing',
    });
    
  } catch (err) {
    console.error('Error uploading audio:', err);
    return NextResponse.json(
      { error: 'Failed to upload audio' },
      { status: 500 }
    );
  }
}

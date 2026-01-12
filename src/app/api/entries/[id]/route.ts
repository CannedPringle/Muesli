import { NextRequest, NextResponse } from 'next/server';
import { getEntry, updateEntry, deleteEntry, getAllSettings, resolveNotePath } from '@/lib/db';
import { hasExternalEdits, readNote } from '@/lib/services/vault';
import { continueJobAfterReview, continueJobAfterPrompts } from '@/lib/job-runner';
import { calculateOverallProgress } from '@/types';
import type { PromptAnswers } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/entries/:id - Get entry with progress
 */
export async function GET(
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
    
    // Check for external edits if completed
    let hasEdits = false;
    if (entry.stage === 'completed' && entry.noteRelpath) {
      hasEdits = await hasExternalEdits(entry);
    }
    
    // For completed entries, content comes from Markdown file
    let noteContent: string | null = null;
    if (entry.stage === 'completed') {
      noteContent = await readNote(entry);
    }
    
    return NextResponse.json({
      ...entry,
      overallProgress: calculateOverallProgress(entry.stage),
      hasExternalEdits: hasEdits,
      noteContent,
    });
    
  } catch (err) {
    console.error('Error getting entry:', err);
    return NextResponse.json(
      { error: 'Failed to get entry' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/entries/:id - Update entry and optionally continue job
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const entry = getEntry(id);
    
    if (!entry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }
    
    // Handle different update scenarios
    const updates: Parameters<typeof updateEntry>[1] = {};
    
    // Update edited transcript
    if (body.editedTranscript !== undefined) {
      updates.editedTranscript = body.editedTranscript;
    }
    
    // Update prompt answers
    if (body.promptAnswers !== undefined) {
      updates.promptAnswers = JSON.stringify(body.promptAnswers as PromptAnswers);
    }
    
    // Apply updates
    if (Object.keys(updates).length > 0) {
      updateEntry(id, updates);
    }
    
    // Handle action to continue the job
    if (body.action === 'continue') {
      if (entry.stage === 'awaiting_review') {
        // Continue after transcript review
        continueJobAfterReview(id).catch(err => {
          console.error('Error continuing job after review:', err);
        });
      } else if (entry.stage === 'awaiting_prompts') {
        // Continue after prompt editing
        continueJobAfterPrompts(id).catch(err => {
          console.error('Error continuing job after prompts:', err);
        });
      }
    }
    
    // Get updated entry
    const updatedEntry = getEntry(id);
    
    return NextResponse.json({
      ...updatedEntry,
      overallProgress: calculateOverallProgress(updatedEntry!.stage),
    });
    
  } catch (err) {
    console.error('Error updating entry:', err);
    return NextResponse.json(
      { error: 'Failed to update entry' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entries/:id - Delete entry and associated files
 */
export async function DELETE(
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
    
    // Delete from database
    const deleted = deleteEntry(id);
    
    // Note: We don't delete the Markdown file - user may want to keep it
    // Audio files are cleaned up by the job runner based on settings
    
    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Entry deleted' : 'Entry not found',
    });
    
  } catch (err) {
    console.error('Error deleting entry:', err);
    return NextResponse.json(
      { error: 'Failed to delete entry' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { createEntry, getAllEntries, getAllSettings } from '@/lib/db';
import { startRunner } from '@/lib/job-runner';
import type { EntryType } from '@/types';
import { calculateOverallProgress } from '@/types';

// Start the job runner when the API is loaded
startRunner();

/**
 * POST /api/entries - Create a new entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entryType = body.entryType as EntryType;
    
    // Validate entry type
    if (!['brain-dump', 'daily-reflection', 'quick-note'].includes(entryType)) {
      return NextResponse.json(
        { error: 'Invalid entry type' },
        { status: 400 }
      );
    }
    
    // Get timezone from settings or request
    const settings = getAllSettings();
    const timezone = body.timezone || settings.defaultTimezone || 'UTC';
    
    // Use provided entry date or calculate from current time
    let entryDate: string;
    if (body.entryDate && /^\d{4}-\d{2}-\d{2}$/.test(body.entryDate)) {
      // Use provided date if it's a valid YYYY-MM-DD format
      entryDate = body.entryDate;
    } else {
      // Calculate entry date (local date in the user's timezone)
      const now = new Date();
      entryDate = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
    }
    
    // Generate ID
    const id = nanoid();
    
    // Create entry
    const entry = createEntry({
      id,
      entryType,
      timezone,
      entryDate,
    });
    
    return NextResponse.json({
      id: entry.id,
      entryType: entry.entryType,
      stage: entry.stage,
      createdAt: entry.createdAt,
      entryDate: entry.entryDate,
    });
    
  } catch (err) {
    console.error('Error creating entry:', err);
    return NextResponse.json(
      { error: 'Failed to create entry' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/entries - List all entries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    const entries = getAllEntries(limit, offset);
    
    // Add computed fields
    const entriesWithProgress = entries.map(entry => ({
      ...entry,
      overallProgress: calculateOverallProgress(entry.stage),
    }));
    
    return NextResponse.json({
      entries: entriesWithProgress,
      count: entries.length,
    });
    
  } catch (err) {
    console.error('Error listing entries:', err);
    return NextResponse.json(
      { error: 'Failed to list entries' },
      { status: 500 }
    );
  }
}

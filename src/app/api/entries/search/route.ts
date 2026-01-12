import { NextRequest, NextResponse } from 'next/server';
import { searchEntries } from '@/lib/db';
import type { EntryType, JobStage } from '@/types';

/**
 * GET /api/entries/search - Search entries with full-text search and filters
 * 
 * Query params:
 * - q: Search query (searches transcript and generated content)
 * - type: Entry type filter (brain-dump, daily-reflection, quick-note)
 * - status: Status filter (active, done, failed, or specific stage)
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - limit: Max results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get('q') || undefined;
    const entryType = searchParams.get('type') as EntryType | null;
    const status = searchParams.get('status') as JobStage | 'active' | 'done' | 'failed' | null;
    const fromDate = searchParams.get('from') || undefined;
    const toDate = searchParams.get('to') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    const result = searchEntries({
      query,
      entryType: entryType || undefined,
      stage: status || undefined,
      fromDate,
      toDate,
      limit,
      offset,
    });
    
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error searching entries:', err);
    return NextResponse.json(
      { error: 'Failed to search entries' },
      { status: 500 }
    );
  }
}

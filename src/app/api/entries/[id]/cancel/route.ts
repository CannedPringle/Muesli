import { NextRequest, NextResponse } from 'next/server';
import { getEntry } from '@/lib/db';
import { requestCancel } from '@/lib/job-runner';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/entries/:id/cancel - Request cancellation of a running job
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
    
    const cancelled = requestCancel(id);
    
    if (!cancelled) {
      return NextResponse.json(
        { 
          error: 'Cannot cancel entry in current stage',
          stage: entry.stage 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Cancellation requested',
    });
    
  } catch (err) {
    console.error('Error cancelling entry:', err);
    return NextResponse.json(
      { error: 'Failed to cancel entry' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getEntry, getEntryLinks, addEntryLink, removeEntryLink, type LinkType } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/entries/[id]/links - Get all related entries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const entry = getEntry(id);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    
    const links = getEntryLinks(id);
    
    return NextResponse.json({
      entryId: id,
      linked: links.linked,
      linkedBy: links.linkedBy,
    });
  } catch (err) {
    console.error('Error getting entry links:', err);
    return NextResponse.json(
      { error: 'Failed to get entry links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/entries/[id]/links - Add a link to another entry
 * Body: { targetId: string, linkType?: 'related' | 'followup' | 'reference' }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { targetId, linkType = 'related' } = body as { 
      targetId: string; 
      linkType?: LinkType;
    };
    
    if (!targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    }
    
    // Verify both entries exist
    const sourceEntry = getEntry(id);
    if (!sourceEntry) {
      return NextResponse.json({ error: 'Source entry not found' }, { status: 404 });
    }
    
    const targetEntry = getEntry(targetId);
    if (!targetEntry) {
      return NextResponse.json({ error: 'Target entry not found' }, { status: 404 });
    }
    
    // Can't link to self
    if (id === targetId) {
      return NextResponse.json({ error: 'Cannot link entry to itself' }, { status: 400 });
    }
    
    addEntryLink(id, targetId, linkType);
    
    // Return updated links
    const links = getEntryLinks(id);
    
    return NextResponse.json({
      entryId: id,
      linked: links.linked,
      linkedBy: links.linkedBy,
    });
  } catch (err) {
    console.error('Error adding entry link:', err);
    return NextResponse.json(
      { error: 'Failed to add entry link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/entries/[id]/links - Remove a link to another entry
 * Body: { targetId: string }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { targetId } = body as { targetId: string };
    
    if (!targetId) {
      return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
    }
    
    removeEntryLink(id, targetId);
    
    // Return updated links
    const links = getEntryLinks(id);
    
    return NextResponse.json({
      entryId: id,
      linked: links.linked,
      linkedBy: links.linkedBy,
    });
  } catch (err) {
    console.error('Error removing entry link:', err);
    return NextResponse.json(
      { error: 'Failed to remove entry link' },
      { status: 500 }
    );
  }
}

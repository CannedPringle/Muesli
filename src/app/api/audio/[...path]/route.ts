import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * GET /api/audio/[...path] - Serve audio files from vault
 * 
 * Example: GET /api/audio/journal/audio/abc123-normalized.wav
 * Serves: {vaultPath}/journal/audio/abc123-normalized.wav
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }
    
    const settings = getAllSettings();
    if (!settings.vaultPath) {
      return NextResponse.json({ error: 'Vault path not configured' }, { status: 500 });
    }
    
    // Join path segments
    const relativePath = pathSegments.join('/');
    
    // Security: Ensure path doesn't escape vault directory
    // Check for path traversal attempts
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    
    // Only allow serving from journal/audio directory
    if (!relativePath.startsWith('journal/audio/')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Resolve full path
    const fullPath = path.join(settings.vaultPath, relativePath);
    
    // Verify path is still within vault (double-check after path.join)
    const resolvedPath = path.resolve(fullPath);
    const resolvedVault = path.resolve(settings.vaultPath);
    if (!resolvedPath.startsWith(resolvedVault)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Read file
    const fileBuffer = await fs.readFile(fullPath);
    
    // Determine content type based on extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    // Get file stats for Content-Length
    const stats = await fs.stat(fullPath);
    
    // Return audio file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Error serving audio file:', err);
    return NextResponse.json(
      { error: 'Failed to serve audio file' },
      { status: 500 }
    );
  }
}

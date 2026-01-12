import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/validate-path - Validate that a directory path exists
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: dirPath } = body;

    if (!dirPath || typeof dirPath !== 'string') {
      return NextResponse.json({
        valid: false,
        error: 'Path is required',
      });
    }

    const trimmedPath = dirPath.trim();

    if (trimmedPath === '') {
      return NextResponse.json({
        valid: false,
        error: 'Path cannot be empty',
      });
    }

    // Expand home directory if needed
    const expandedPath = trimmedPath.startsWith('~')
      ? path.join(process.env.HOME || '', trimmedPath.slice(1))
      : trimmedPath;

    // Check if path exists
    if (!fs.existsSync(expandedPath)) {
      return NextResponse.json({
        valid: false,
        error: 'Directory does not exist',
      });
    }

    // Check if it's a directory
    const stats = fs.statSync(expandedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({
        valid: false,
        error: 'Path is not a directory',
      });
    }

    // Check if we can write to it
    try {
      fs.accessSync(expandedPath, fs.constants.W_OK);
    } catch {
      return NextResponse.json({
        valid: false,
        error: 'Directory is not writable',
      });
    }

    return NextResponse.json({
      valid: true,
      expandedPath,
    });
  } catch (err) {
    console.error('Error validating path:', err);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate path' },
      { status: 500 }
    );
  }
}

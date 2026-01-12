'use client';

import { useState, useCallback } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AudioUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
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

const ACCEPTED_EXTENSIONS = '.webm,.mp3,.m4a,.wav,.ogg,.flac,.mp4,.mpeg';

export function AudioUpload({ onFileSelected, disabled }: AudioUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return false;
    }
    
    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 500MB');
      return false;
    }
    
    setError(null);
    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(f => f.type.startsWith('audio/'));
    
    if (audioFile) {
      handleFile(audioFile);
    } else {
      setError('Please drop an audio file');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
  };

  const handleUseFile = () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {!selectedFile ? (
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!disabled) {
                document.getElementById('audio-upload-input')?.click();
              }
            }}
          >
            <input
              id="audio-upload-input"
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleInputChange}
              className="hidden"
              disabled={disabled}
            />
            
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            
            <p className="text-sm font-medium mb-1">
              {isDragging ? 'Drop audio file here' : 'Drag & drop an audio file'}
            </p>
            <p className="text-xs text-muted-foreground">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supports MP3, M4A, WAV, WebM, OGG, FLAC
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <File className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleClear}>
                Choose Different File
              </Button>
              <Button onClick={handleUseFile}>
                <Upload className="h-4 w-4 mr-2" />
                Use This File
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive mt-4 text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

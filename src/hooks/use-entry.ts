'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Entry, EntryResponse, Settings, PromptAnswers } from '@/types';

// ============================================
// useEntry - Manage single entry with polling
// ============================================

interface UseEntryOptions {
  pollInterval?: number;
  pollWhileProcessing?: boolean;
}

interface UseEntryReturn {
  entry: EntryResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateEntry: (data: { editedTranscript?: string; promptAnswers?: PromptAnswers; entryDate?: string; action?: 'continue' }) => Promise<void>;
  cancelEntry: () => Promise<void>;
  isPolling: boolean;
}

export function useEntry(entryId: string | null, options: UseEntryOptions = {}): UseEntryReturn {
  const { pollInterval = 1000, pollWhileProcessing = true } = options;
  
  const [entry, setEntry] = useState<EntryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEntry = useCallback(async () => {
    if (!entryId) return;
    
    try {
      const response = await fetch(`/api/entries/${entryId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch entry');
      }
      const data = await response.json();
      setEntry(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [entryId]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchEntry();
    setIsLoading(false);
  }, [fetchEntry]);

  const updateEntry = useCallback(async (data: { 
    editedTranscript?: string; 
    promptAnswers?: PromptAnswers;
    entryDate?: string;
    action?: 'continue';
  }) => {
    if (!entryId) return;
    
    try {
      const response = await fetch(`/api/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update entry');
      }
      
      const updated = await response.json();
      setEntry(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [entryId]);

  const cancelEntry = useCallback(async () => {
    if (!entryId) return;
    
    try {
      const response = await fetch(`/api/entries/${entryId}/cancel`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel entry');
      }
      
      await fetchEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [entryId, fetchEntry]);

  // Initial fetch
  useEffect(() => {
    if (entryId) {
      refetch();
    } else {
      setEntry(null);
    }
  }, [entryId, refetch]);

  // Polling for processing entries
  useEffect(() => {
    if (!pollWhileProcessing || !entry) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsPolling(false);
      }
      return;
    }

    // Stages that need polling
    const processingStages = [
      'pending', 'queued', 'normalizing', 'transcribing', 'generating', 'writing', 'cancel_requested'
    ];

    if (processingStages.includes(entry.stage)) {
      setIsPolling(true);
      pollIntervalRef.current = setInterval(fetchEntry, pollInterval);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setIsPolling(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [entry?.stage, pollWhileProcessing, pollInterval, fetchEntry]);

  return {
    entry,
    isLoading,
    error,
    refetch,
    updateEntry,
    cancelEntry,
    isPolling,
  };
}

// ============================================
// useEntries - List all entries
// ============================================

interface UseEntriesReturn {
  entries: Entry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEntries(limit = 50): UseEntriesReturn {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch(`/api/entries?limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      const data = await response.json();
      setEntries(data.entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return {
    entries,
    isLoading,
    error,
    refetch: fetchEntries,
  };
}

// ============================================
// useCreateEntry - Create new entry
// ============================================

interface UseCreateEntryReturn {
  createEntry: (entryType: 'brain-dump' | 'daily-reflection' | 'quick-note', entryDate?: string) => Promise<string>;
  isCreating: boolean;
  error: string | null;
}

export function useCreateEntry(): UseCreateEntryReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEntry = useCallback(async (
    entryType: 'brain-dump' | 'daily-reflection' | 'quick-note',
    entryDate?: string
  ): Promise<string> => {
    setIsCreating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          entryType,
          entryDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create entry');
      }
      
      const data = await response.json();
      return data.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    createEntry,
    isCreating,
    error,
  };
}

// ============================================
// useUploadAudio - Upload audio to entry
// ============================================

interface UseUploadAudioReturn {
  uploadAudio: (entryId: string, audioBlob: Blob, filename?: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

export function useUploadAudio(): UseUploadAudioReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadAudio = useCallback(async (entryId: string, audioBlob: Blob, filename = 'recording.webm') => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      
      const response = await fetch(`/api/entries/${entryId}/audio`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload audio');
      }
      
      setUploadProgress(100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    uploadAudio,
    isUploading,
    uploadProgress,
    error,
  };
}

// ============================================
// useSettings - Manage settings
// ============================================

interface UseSettingsReturn {
  settings: Settings | null;
  isLoading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}

// ============================================
// usePrerequisites - Check prerequisites
// ============================================

import type { PrerequisitesCheck } from '@/types';

interface UsePrerequisitesReturn {
  prerequisites: PrerequisitesCheck | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePrerequisites(): UsePrerequisitesReturn {
  const [prerequisites, setPrerequisites] = useState<PrerequisitesCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrerequisites = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/prerequisites');
      if (!response.ok) {
        throw new Error('Failed to check prerequisites');
      }
      const data = await response.json();
      setPrerequisites(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrerequisites();
  }, [fetchPrerequisites]);

  return {
    prerequisites,
    isLoading,
    error,
    refetch: fetchPrerequisites,
  };
}

// ============================================
// useOpenNote - Open note actions
// ============================================

interface UseOpenNoteReturn {
  openInObsidian: (entryId: string) => Promise<void>;
  revealInFinder: (entryId: string) => Promise<void>;
  isOpening: boolean;
  error: string | null;
}

export function useOpenNote(): UseOpenNoteReturn {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNote = useCallback(async (entryId: string, action: 'obsidian' | 'finder') => {
    setIsOpening(true);
    setError(null);
    
    try {
      const response = await fetch('/api/open-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open note');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsOpening(false);
    }
  }, []);

  return {
    openInObsidian: (entryId: string) => openNote(entryId, 'obsidian'),
    revealInFinder: (entryId: string) => openNote(entryId, 'finder'),
    isOpening,
    error,
  };
}

// ============================================
// useWhisperModels - Check installed Whisper models
// ============================================

export interface WhisperModelInfo {
  name: string;
  size: string;
  installed: boolean;
  path: string;
}

export interface WhisperModelsData {
  models: WhisperModelInfo[];
  selectedModel: string;
  selectedModelInstalled: boolean;
  modelsDir: string;
}

interface UseWhisperModelsReturn {
  data: WhisperModelsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWhisperModels(): UseWhisperModelsReturn {
  const [data, setData] = useState<WhisperModelsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/whisper');
      if (!response.ok) {
        throw new Error('Failed to fetch whisper models');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchModels,
  };
}

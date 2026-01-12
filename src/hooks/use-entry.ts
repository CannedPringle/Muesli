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

interface UpdateEntryData {
  editedTranscript?: string;
  promptAnswers?: PromptAnswers;
  entryDate?: string;
  action?: 'continue';
  editedSections?: Record<string, string>;
}

interface UseEntryReturn {
  entry: EntryResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateEntry: (data: UpdateEntryData) => Promise<void>;
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

  const updateEntry = useCallback(async (data: UpdateEntryData) => {
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
// useSearchEntries - Search entries with filters
// ============================================

export interface SearchFilters {
  query?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
}

interface SearchResult {
  entries: Entry[];
  total: number;
  hasMore: boolean;
}

interface UseSearchEntriesReturn {
  results: SearchResult | null;
  isLoading: boolean;
  error: string | null;
  search: (filters: SearchFilters) => Promise<void>;
}

export function useSearchEntries(): UseSearchEntriesReturn {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (filters: SearchFilters) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set('q', filters.query);
      if (filters.type && filters.type !== 'all') params.set('type', filters.type);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      
      const response = await fetch(`/api/entries/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to search entries');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
  };
}

// ============================================
// useEntryLinks - Manage entry relationships
// ============================================

interface EntryLinksData {
  entryId: string;
  linked: Entry[];
  linkedBy: Entry[];
}

interface UseEntryLinksReturn {
  links: EntryLinksData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addLink: (targetId: string, linkType?: 'related' | 'followup' | 'reference') => Promise<void>;
  removeLink: (targetId: string) => Promise<void>;
}

export function useEntryLinks(entryId: string | null): UseEntryLinksReturn {
  const [links, setLinks] = useState<EntryLinksData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!entryId) {
      setLinks(null);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/entries/${entryId}/links`);
      if (!response.ok) {
        throw new Error('Failed to fetch entry links');
      }
      const data = await response.json();
      setLinks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [entryId]);

  const addLink = useCallback(async (targetId: string, linkType: 'related' | 'followup' | 'reference' = 'related') => {
    if (!entryId) return;
    
    try {
      const response = await fetch(`/api/entries/${entryId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, linkType }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add link');
      }
      
      const data = await response.json();
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [entryId]);

  const removeLink = useCallback(async (targetId: string) => {
    if (!entryId) return;
    
    try {
      const response = await fetch(`/api/entries/${entryId}/links`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove link');
      }
      
      const data = await response.json();
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [entryId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  return {
    links,
    isLoading,
    error,
    refetch: fetchLinks,
    addLink,
    removeLink,
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

// ============================================
// useOllamaModels - Fetch available Ollama models
// ============================================

export interface OllamaModelInfo {
  name: string;
  size?: number;
  modified_at?: string;
}

interface UseOllamaModelsReturn {
  models: OllamaModelInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: (baseUrl?: string) => Promise<void>;
}

export function useOllamaModels(initialBaseUrl: string): UseOllamaModelsReturn {
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baseUrlRef = useRef(initialBaseUrl);

  const fetchModels = useCallback(async (baseUrl?: string) => {
    const url = baseUrl || baseUrlRef.current;
    if (baseUrl) {
      baseUrlRef.current = baseUrl;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error('Failed to connect to Ollama');
      }
      
      const data = await response.json();
      const modelList: OllamaModelInfo[] = (data.models || []).map((m: { name: string; size?: number; modified_at?: string }) => ({
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      }));
      
      setModels(modelList);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('timeout') || message.includes('abort')) {
        setError(`Cannot connect to Ollama at ${url}. Is it running?`);
      } else {
        setError(`Cannot connect to Ollama: ${message}`);
      }
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels(initialBaseUrl);
  }, [initialBaseUrl, fetchModels]);

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
  };
}

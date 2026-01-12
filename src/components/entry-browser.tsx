'use client';

import { useState, useCallback, useEffect } from 'react';
import { EntrySidebar } from '@/components/entry-sidebar';
import { EntryDetail } from '@/components/entry-detail';
import { EntryWizard } from '@/components/entry-wizard';
import { EntryContextPane } from '@/components/entry-context-pane';
import type { Entry } from '@/types';
import { Sparkles, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EntryBrowserProps {
  onEntryComplete?: () => void;
}

export function EntryBrowser({ onEntryComplete }: EntryBrowserProps) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Right pane toggle state (persisted)
  const [contextPaneOpen, setContextPaneOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('muesli:context-pane-open') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('muesli:context-pane-open', String(contextPaneOpen));
  }, [contextPaneOpen]);

  const handleSelectEntry = useCallback((entry: Entry) => {
    setSelectedEntry(entry);
    setIsCreatingNew(false);
    // Auto-open context pane on selection if it was closed? 
    // Or respect user preference? Let's respect preference but ensure it's usable.
    if (!contextPaneOpen) setContextPaneOpen(true);
  }, [contextPaneOpen]);

  const handleNewEntry = useCallback(() => {
    setSelectedEntry(null);
    setIsCreatingNew(true);
  }, []);

  const handleWizardComplete = useCallback(() => {
    setIsCreatingNew(false);
    setRefreshKey((k) => k + 1);
    onEntryComplete?.();
  }, [onEntryComplete]);

  const handleEntryUpdated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50 dark:bg-stone-950">
      {/* Sidebar - Library (Left) */}
      <aside className="w-80 flex-shrink-0 border-r border-stone-200 bg-stone-50 dark:bg-stone-950 dark:border-stone-800 z-20">
        <EntrySidebar
          key={refreshKey}
          selectedEntryId={selectedEntry?.id ?? null}
          onSelectEntry={handleSelectEntry}
          onNewEntry={handleNewEntry}
        />
      </aside>

      {/* Main Content - Paper (Center) */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full relative z-10 transition-all duration-300">
        {isCreatingNew ? (
          <div className="h-full overflow-hidden animate-in fade-in duration-300 bg-white dark:bg-stone-900">
            <EntryWizard 
              onComplete={handleWizardComplete}
            />
          </div>
        ) : selectedEntry ? (
          <EntryDetail 
            entryId={selectedEntry.id}
            onNewEntry={handleNewEntry}
            onEntryUpdated={handleEntryUpdated}
            onSelectEntry={handleSelectEntry}
            contextPaneOpen={contextPaneOpen}
            onToggleContextPane={() => setContextPaneOpen(p => !p)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-stone-900 flex items-center justify-center mb-6 shadow-sm border border-stone-100 dark:border-stone-800">
              <Sparkles className="w-8 h-8 text-stone-400 dark:text-stone-500" />
            </div>
            <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
              Ready to think?
            </h2>
            <p className="text-stone-500 dark:text-stone-400 max-w-sm mb-8 leading-relaxed">
              Select an entry from the sidebar or start a new session to capture your thoughts.
            </p>
            <Button 
              onClick={handleNewEntry}
              className="group relative overflow-hidden bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 transition-all duration-300 shadow-md hover:shadow-lg rounded-full px-8"
            >
              <PenLine className="w-4 h-4 mr-2" />
              Start New Entry
            </Button>
          </div>
        )}
      </main>

      {/* Context Pane - Metadata (Right) */}
      {selectedEntry && contextPaneOpen && !isCreatingNew && (
        <aside className="w-80 flex-shrink-0 border-l border-stone-200/50 bg-stone-50 dark:bg-stone-950 dark:border-stone-800 z-20 min-h-0 animate-in slide-in-from-right-4 duration-300">
          <EntryContextPane 
            entry={selectedEntry}
            onSelectEntry={handleSelectEntry}
          />
        </aside>
      )}
    </div>
  );
}

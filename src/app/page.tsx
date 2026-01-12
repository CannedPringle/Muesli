'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Settings, BookOpen, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EntryWizard } from '@/components/entry-wizard';
import { EntryHistory } from '@/components/entry-history';
import { PrerequisitesCheckComponent } from '@/components/prerequisites-check';
import { ThemeToggle } from '@/components/theme-toggle';
import { usePrerequisites, useSettings } from '@/hooks/use-entry';
import { Toaster } from '@/components/ui/sonner';
import type { Entry } from '@/types';

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
        <div>
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { prerequisites, isLoading: prereqLoading, error: prereqError, refetch: refetchPrereq } = usePrerequisites();
  const { settings, isLoading: settingsLoading } = useSettings();
  const [historyKey, setHistoryKey] = useState(0);

  const isLoading = prereqLoading || settingsLoading;
  const needsSetup = !prerequisites?.allReady || !settings?.vaultPath;

  const handleEntryComplete = useCallback(() => {
    // Refresh the history when an entry is completed
    setHistoryKey((k) => k + 1);
  }, []);

  const handleSelectEntry = useCallback((entry: Entry) => {
    // For now, we could navigate to a detail view or resume an in-progress entry
    // This is a placeholder for future enhancement
    console.log('Selected entry:', entry.id);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toaster />
      
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <h1 className="text-xl font-bold">Whisper Journal</h1>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 flex-1">
        {isLoading ? (
          <LoadingSkeleton />
        ) : needsSetup ? (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Prerequisites check */}
            {!prerequisites?.allReady && (
              <PrerequisitesCheckComponent
                prerequisites={prerequisites}
                isLoading={prereqLoading}
                error={prereqError}
                onRefresh={refetchPrereq}
              />
            )}

            {/* Vault path warning */}
            {prerequisites?.allReady && !settings?.vaultPath && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Vault Path Required</AlertTitle>
                <AlertDescription>
                  Please configure your Obsidian vault path in settings before creating entries.
                  <div className="mt-2">
                    <Link href="/settings">
                      <Button size="sm">Open Settings</Button>
                    </Link>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Entry Wizard - Takes 3/5 of the space */}
              <div className="lg:col-span-3">
                <EntryWizard onComplete={handleEntryComplete} />
              </div>
              
              {/* Entry History - Takes 2/5 of the space */}
              <div className="lg:col-span-2">
                <EntryHistory 
                  key={historyKey}
                  onSelectEntry={handleSelectEntry}
                  limit={20}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Whisper Journal — Local-first voice journaling with AI
        </div>
      </footer>
    </div>
  );
}

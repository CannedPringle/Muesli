'use client';

import Link from 'next/link';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';
import { EntryBrowser } from '@/components/entry-browser';
import { PrerequisitesCheckComponent } from '@/components/prerequisites-check';

import { usePrerequisites, useSettings } from '@/hooks/use-entry';
import { Toaster } from '@/components/ui/sonner';

function LoadingSkeleton() {
  return (
    <div className="flex h-screen w-full bg-stone-50/50 dark:bg-stone-950">
      <div className="w-72 border-r bg-stone-50/50 p-4 dark:bg-stone-900/50 dark:border-stone-800">
        <Skeleton className="h-8 w-3/4 rounded-md mb-8 bg-stone-200 dark:bg-stone-800" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-md bg-stone-200 dark:bg-stone-800" />
          <Skeleton className="h-12 w-full rounded-md bg-stone-200 dark:bg-stone-800" />
          <Skeleton className="h-12 w-full rounded-md bg-stone-200 dark:bg-stone-800" />
        </div>
      </div>
      <div className="flex-1 p-12">
        <Skeleton className="h-12 w-1/3 mb-8 bg-stone-200 dark:bg-stone-800" />
        <div className="space-y-4 max-w-2xl">
          <Skeleton className="h-4 w-full bg-stone-200 dark:bg-stone-800" />
          <Skeleton className="h-4 w-5/6 bg-stone-200 dark:bg-stone-800" />
          <Skeleton className="h-4 w-4/6 bg-stone-200 dark:bg-stone-800" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { prerequisites, isLoading: prereqLoading, error: prereqError, refetch: refetchPrereq } = usePrerequisites();
  const { settings, isLoading: settingsLoading } = useSettings();

  const isLoading = prereqLoading || settingsLoading;
  const needsSetup = !prerequisites?.allReady || !settings?.vaultPath;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="h-screen w-full bg-background flex overflow-hidden font-sans antialiased text-stone-900 dark:text-stone-100">
      <Toaster position="bottom-right" theme="system" />
      
      {needsSetup ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-stone-50 dark:bg-stone-950">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-stone-100 dark:bg-stone-900 mb-4">
                <Sparkles className="h-8 w-8 text-stone-900 dark:text-stone-100" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                Welcome to Muesli
              </h1>
              <p className="text-stone-500 dark:text-stone-400">
                Your local-first AI thinking partner.
              </p>
            </div>

            <div className="space-y-6">
              {!prerequisites?.allReady && (
                <PrerequisitesCheckComponent
                  prerequisites={prerequisites}
                  isLoading={prereqLoading}
                  error={prereqError}
                  onRefresh={refetchPrereq}
                />
              )}

              {prerequisites?.allReady && !settings?.vaultPath && (
                <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600 dark:bg-amber-950/30 dark:text-amber-500">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium">Vault Setup Required</h3>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        Please configure your Obsidian vault path to start creating structured journals.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Link href="/settings">
                      <Button className="bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200">
                        Open Settings
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EntryBrowser />
      )}
    </div>
  );
}

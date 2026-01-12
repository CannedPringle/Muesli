'use client';

import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PrerequisitesCheck } from '@/types';

interface PrerequisitesCheckComponentProps {
  prerequisites: PrerequisitesCheck | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function PrerequisitesCheckComponent({
  prerequisites,
  isLoading,
  error,
  onRefresh,
}: PrerequisitesCheckComponentProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Checking prerequisites...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={onRefresh}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prerequisites) return null;

  const items = [
    prerequisites.ffmpeg,
    prerequisites.whisper,
    prerequisites.ollama,
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Setup Required
          {prerequisites.allReady && (
            <Badge variant="default" className="bg-green-500">All Ready</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Whisper Journal requires these tools to be installed on your Mac.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={item.name}
            className={`
              flex items-center justify-between p-4 rounded-lg border
              ${item.installed ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'}
            `}
          >
            <div className="flex items-center gap-3">
              {item.installed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="font-medium">{item.name}</p>
                {item.installed && item.version && (
                  <p className="text-xs text-muted-foreground">{item.version}</p>
                )}
                {!item.installed && item.error && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{item.error}</p>
                )}
              </div>
            </div>
            {!item.installed && item.installCommand && (
              <div className="text-right">
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {item.installCommand}
                </code>
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={onRefresh}>
            Refresh Status
          </Button>
          <a
            href="https://ollama.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Get Ollama
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

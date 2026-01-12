'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, FolderOpen, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSettings, usePrerequisites, useWhisperModels } from '@/hooks/use-entry';
import { PrerequisitesCheckComponent } from '@/components/prerequisites-check';
import { ThemeToggle } from '@/components/theme-toggle';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const WHISPER_MODELS = [
  { value: 'tiny', label: 'Tiny (~75MB)', description: 'Fastest, lower accuracy' },
  { value: 'base', label: 'Base (~150MB)', description: 'Fast, good for clear audio' },
  { value: 'small', label: 'Small (~500MB)', description: 'Balanced speed/accuracy' },
  { value: 'medium', label: 'Medium (~1.5GB)', description: 'Better accuracy, slower' },
  { value: 'large-v3', label: 'Large V3 (~3GB)', description: 'Best accuracy, slowest' },
];

const OLLAMA_MODELS = [
  { value: 'gpt-oss:20b', label: 'GPT-OSS 20B', description: 'OpenAI open-weight, 14GB' },
  { value: 'gpt-oss:120b', label: 'GPT-OSS 120B', description: 'Larger model, 65GB' },
  { value: 'qwen3:8b', label: 'Qwen 3 8B', description: 'Fast & capable, 5.2GB' },
  { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B', description: 'Good balance, 4GB' },
  { value: 'llama3.2:3b', label: 'Llama 3.2 3B', description: 'Faster, smaller' },
  { value: 'llama3.1:8b', label: 'Llama 3.1 8B', description: 'Good reasoning' },
  { value: 'mistral:7b', label: 'Mistral 7B', description: 'Good for writing' },
];

export default function SettingsPage() {
  const { settings, isLoading, updateSettings, refetch } = useSettings();
  const { prerequisites, isLoading: prereqLoading, refetch: refetchPrereq } = usePrerequisites();
  const { data: whisperModels, refetch: refetchWhisperModels } = useWhisperModels();
  
  const [formData, setFormData] = useState({
    vaultPath: '',
    whisperModelName: 'small',
    whisperModelPath: '',
    whisperPrompt: '',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'gpt-oss:20b',
    keepAudio: true,
    defaultTimezone: '',
    userName: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setFormData({
        vaultPath: settings.vaultPath || '',
        whisperModelName: settings.whisperModelName || 'small',
        whisperModelPath: settings.whisperModelPath || '',
        whisperPrompt: settings.whisperPrompt || '',
        ollamaBaseUrl: settings.ollamaBaseUrl || 'http://localhost:11434',
        ollamaModel: settings.ollamaModel || 'qwen2.5:7b',
        keepAudio: settings.keepAudio ?? true,
        defaultTimezone: settings.defaultTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        userName: settings.userName || '',
      });
    }
  }, [settings]);

  const handleChange = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      setHasChanges(false);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Prerequisites Status */}
        <PrerequisitesCheckComponent
          prerequisites={prerequisites}
          isLoading={prereqLoading}
          error={null}
          onRefresh={refetchPrereq}
        />

        <Separator />

        {/* Vault Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Obsidian Vault</CardTitle>
            <CardDescription>
              Configure where journal entries are saved
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vaultPath">Vault Path</Label>
              <div className="flex gap-2">
                <Input
                  id="vaultPath"
                  value={formData.vaultPath}
                  onChange={(e) => handleChange('vaultPath', e.target.value)}
                  placeholder="/path/to/your/obsidian/vault"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The folder where your Obsidian vault is located. Journal entries will be saved here.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Personalize your journal entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                value={formData.userName}
                onChange={(e) => handleChange('userName', e.target.value)}
                placeholder="Enter your name"
              />
              <p className="text-xs text-muted-foreground">
                Used to personalize your Daily Strategic Journal entries. Leave blank for generic format.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Whisper Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Transcription (Whisper)</CardTitle>
            <CardDescription>
              Configure speech-to-text settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whisperModel">Model</Label>
              <Select
                value={formData.whisperModelName}
                onValueChange={(v) => {
                  handleChange('whisperModelName', v);
                  // Refetch models to update installed status display
                  refetchWhisperModels();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {WHISPER_MODELS.map((model) => {
                    const modelInfo = whisperModels?.models.find(m => m.name === model.value);
                    const isInstalled = modelInfo?.installed ?? false;
                    
                    return (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex items-center gap-2">
                          {isInstalled ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="font-medium">{model.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.description}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {/* Show warning if selected model is not installed */}
              {whisperModels && !whisperModels.selectedModelInstalled && formData.whisperModelName === whisperModels.selectedModel && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Model &quot;{formData.whisperModelName}&quot; is not installed
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      Run in terminal:
                    </p>
                    <code className="block mt-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/50 rounded text-xs font-mono">
                      npm run setup:whisper:{formData.whisperModelName}
                    </code>
                  </div>
                </div>
              )}
              
              {/* Show success if model is installed */}
              {whisperModels && whisperModels.selectedModelInstalled && formData.whisperModelName === whisperModels.selectedModel && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Model installed and ready</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whisperModelPath">Custom Model Path (Optional)</Label>
              <Input
                id="whisperModelPath"
                value={formData.whisperModelPath}
                onChange={(e) => handleChange('whisperModelPath', e.target.value)}
                placeholder="Leave empty for default (~/.whisper/models/)"
              />
              <p className="text-xs text-muted-foreground">
                Override the default model path if you have models in a custom location.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whisperPrompt">Transcription Prompt (Optional)</Label>
              <Textarea
                id="whisperPrompt"
                value={formData.whisperPrompt}
                onChange={(e) => handleChange('whisperPrompt', e.target.value)}
                placeholder="Claude Code, Obsidian, Next.js, TypeScript, shadcn, Tailwind"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Provide context to improve transcription accuracy. Include names, technical terms,
                or words that are frequently misheard. Separate with commas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Ollama Settings */}
        <Card>
          <CardHeader>
            <CardTitle>AI Processing (Ollama)</CardTitle>
            <CardDescription>
              Configure the local LLM for journal generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ollamaBaseUrl">Ollama URL</Label>
              <Input
                id="ollamaBaseUrl"
                value={formData.ollamaBaseUrl}
                onChange={(e) => handleChange('ollamaBaseUrl', e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ollamaModel">Model</Label>
              <Select
                value={formData.ollamaModel}
                onValueChange={(v) => handleChange('ollamaModel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {OLLAMA_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <div>
                        <span className="font-medium">{model.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {model.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Make sure the model is pulled: <code>ollama pull {formData.ollamaModel}</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Storage Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Storage</CardTitle>
            <CardDescription>
              Configure file storage behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Keep Audio Files</Label>
                <p className="text-xs text-muted-foreground">
                  Store original audio recordings alongside journal entries
                </p>
              </div>
              <Select
                value={formData.keepAudio ? 'true' : 'false'}
                onValueChange={(v) => handleChange('keepAudio', v === 'true')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Timezone */}
        <Card>
          <CardHeader>
            <CardTitle>Timezone</CardTitle>
            <CardDescription>
              Your local timezone for journal entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={formData.defaultTimezone}
                onChange={(e) => handleChange('defaultTimezone', e.target.value)}
                placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone}
              />
              <p className="text-xs text-muted-foreground">
                IANA timezone identifier (e.g., America/Los_Angeles, Europe/London)
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Settings2, 
  Cpu, 
  HardDrive, 
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { useSettings, useWhisperModels, useOllamaModels } from '@/hooks/use-entry';
import type { Settings } from '@/types';

type SettingsTab = 'general' | 'transcription' | 'storage';

// Common timezone options
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European Time' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
  { value: 'Asia/Shanghai', label: 'China Standard Time' },
  { value: 'Asia/Kolkata', label: 'India Standard Time' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time' },
  { value: 'UTC', label: 'UTC' },
];

interface NavItemProps {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: (id: SettingsTab) => void;
}

function NavItem({ id, label, icon, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive 
          ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100" 
          : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:hover:bg-stone-900 dark:hover:text-stone-100"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Separator />
      <Card className="border-stone-200 dark:border-stone-800">
        <CardHeader>
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Load settings from API
  const { settings, isLoading: settingsLoading, updateSettings, refetch } = useSettings();
  
  // Local form state
  const [formData, setFormData] = useState<Partial<Settings>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Whisper models
  const { data: whisperData, isLoading: whisperLoading } = useWhisperModels();
  
  // Ollama models - use formData.ollamaBaseUrl or default
  const ollamaBaseUrl = formData.ollamaBaseUrl || settings?.ollamaBaseUrl || 'http://localhost:11434';
  const { models: ollamaModels, isLoading: ollamaLoading, error: ollamaError, refetch: refetchOllama } = useOllamaModels(ollamaBaseUrl);

  // Sync settings to form when loaded
  useEffect(() => {
    if (settings && !isDirty) {
      setFormData({
        userName: settings.userName,
        defaultTimezone: settings.defaultTimezone,
        whisperModelName: settings.whisperModelName,
        whisperPrompt: settings.whisperPrompt,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        ollamaModel: settings.ollamaModel,
        vaultPath: settings.vaultPath,
        keepAudio: settings.keepAudio,
      });
    }
  }, [settings, isDirty]);

  // Avoid hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update form field
  const updateField = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    // Clear validation error when field changes
    if (validationErrors[key]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [validationErrors]);

  // Validate vault path
  const validateVaultPath = async (path: string): Promise<boolean> => {
    if (!path || path.trim() === '') {
      setValidationErrors(prev => ({ ...prev, vaultPath: 'Vault path is required' }));
      return false;
    }

    try {
      const response = await fetch('/api/validate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      
      const result = await response.json();
      
      if (!result.valid) {
        setValidationErrors(prev => ({ ...prev, vaultPath: result.error }));
        return false;
      }
      
      return true;
    } catch {
      setValidationErrors(prev => ({ ...prev, vaultPath: 'Failed to validate path' }));
      return false;
    }
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    setValidationErrors({});

    try {
      // Validate vault path if it changed
      if (formData.vaultPath !== settings?.vaultPath) {
        const isValid = await validateVaultPath(formData.vaultPath || '');
        if (!isValid) {
          setIsSaving(false);
          return;
        }
      }

      await updateSettings(formData);
      setIsDirty(false);
      toast.success('Settings saved');
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Refetch Ollama models when base URL changes
  const handleOllamaUrlBlur = () => {
    if (formData.ollamaBaseUrl && formData.ollamaBaseUrl !== settings?.ollamaBaseUrl) {
      refetchOllama(formData.ollamaBaseUrl);
    }
  };

  const isLoading = settingsLoading;

  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Toaster position="bottom-right" />
      
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-950/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-stone-200 dark:bg-stone-800" />
          <h1 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <div className="col-span-3 space-y-1">
            <NavItem 
              id="general" 
              label="General" 
              icon={<Settings2 className="h-4 w-4" />} 
              isActive={activeTab === 'general'} 
              onClick={setActiveTab} 
            />
            <NavItem 
              id="transcription" 
              label="Intelligence" 
              icon={<Cpu className="h-4 w-4" />} 
              isActive={activeTab === 'transcription'} 
              onClick={setActiveTab} 
            />
            <NavItem 
              id="storage" 
              label="Data & Storage" 
              icon={<HardDrive className="h-4 w-4" />} 
              isActive={activeTab === 'storage'} 
              onClick={setActiveTab} 
            />
          </div>

          {/* Content Area */}
          <div className="col-span-9 space-y-6">
            {isLoading ? (
              <SettingsSkeleton />
            ) : (
              <>
                {/* General Tab */}
                {activeTab === 'general' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">General Settings</h2>
                      <p className="text-sm text-stone-500">Manage your profile and preferences.</p>
                    </div>
                    <Separator />
                    
                    {/* Profile */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Profile</CardTitle>
                        <CardDescription>Your name is used in journal prompts.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="userName">Your Name</Label>
                          <Input
                            id="userName"
                            placeholder="Enter your name"
                            value={formData.userName || ''}
                            onChange={(e) => updateField('userName', e.target.value)}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Appearance */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Appearance</CardTitle>
                        <CardDescription>Customize how Muesli looks.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Theme</Label>
                          {mounted && (
                            <Select value={theme} onValueChange={setTheme}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <p className="text-xs text-stone-500">
                            Choose your preferred color scheme. &ldquo;System&rdquo; follows your OS setting.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Locale */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Locale</CardTitle>
                        <CardDescription>Set your default timezone for journal entries.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="timezone">Default Timezone</Label>
                          <Select 
                            value={formData.defaultTimezone || 'UTC'} 
                            onValueChange={(value) => updateField('defaultTimezone', value)}
                          >
                            <SelectTrigger id="timezone">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSave} 
                        disabled={!isDirty || isSaving}
                        className="min-w-[120px]"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Intelligence Tab */}
                {activeTab === 'transcription' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">Intelligence</h2>
                      <p className="text-sm text-stone-500">Configure AI models for transcription and processing.</p>
                    </div>
                    <Separator />

                    {/* Whisper */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Transcription (Whisper)</CardTitle>
                        <CardDescription>Configure the speech-to-text model.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Model Size</Label>
                          {whisperLoading ? (
                            <Skeleton className="h-10 w-full" />
                          ) : (
                            <Select 
                              value={formData.whisperModelName || 'small'} 
                              onValueChange={(value) => updateField('whisperModelName', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {whisperData?.models.map((model) => (
                                  <SelectItem key={model.name} value={model.name}>
                                    <div className="flex items-center gap-2">
                                      <span className="capitalize">{model.name}</span>
                                      <span className="text-xs text-stone-400">({model.size})</span>
                                      {model.installed ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <span className="text-xs text-amber-500">Not installed</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {/* Warning if selected model not installed */}
                          {whisperData && formData.whisperModelName && 
                            !whisperData.models.find(m => m.name === formData.whisperModelName)?.installed && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-sm">
                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Model not installed</p>
                                <p className="text-xs mt-1">
                                  Run: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">npm run setup:whisper:{formData.whisperModelName}</code>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="whisperPrompt">Whisper Prompt (Optional)</Label>
                          <Textarea
                            id="whisperPrompt"
                            placeholder="Optional context to improve transcription accuracy..."
                            value={formData.whisperPrompt || ''}
                            onChange={(e) => updateField('whisperPrompt', e.target.value)}
                            rows={3}
                          />
                          <p className="text-xs text-stone-500">
                            Provide context like names, technical terms, or speaking style to improve accuracy.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Ollama */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Language Model (Ollama)</CardTitle>
                        <CardDescription>Configure the LLM for journal generation.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="ollamaUrl">Ollama URL</Label>
                          <Input
                            id="ollamaUrl"
                            placeholder="http://localhost:11434"
                            value={formData.ollamaBaseUrl || ''}
                            onChange={(e) => updateField('ollamaBaseUrl', e.target.value)}
                            onBlur={handleOllamaUrlBlur}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Model</Label>
                          {ollamaLoading ? (
                            <Skeleton className="h-10 w-full" />
                          ) : ollamaError ? (
                            <div className="space-y-2">
                              <Select disabled>
                                <SelectTrigger>
                                  <SelectValue placeholder="Cannot load models" />
                                </SelectTrigger>
                              </Select>
                              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-sm">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium">Cannot connect to Ollama</p>
                                  <p className="text-xs mt-1">{ollamaError}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Select 
                              value={formData.ollamaModel || ''} 
                              onValueChange={(value) => updateField('ollamaModel', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                              <SelectContent>
                                {ollamaModels.length === 0 ? (
                                  <div className="p-2 text-sm text-stone-500 text-center">
                                    No models installed
                                  </div>
                                ) : (
                                  ollamaModels.map((model) => (
                                    <SelectItem key={model.name} value={model.name}>
                                      <div className="flex items-center gap-2">
                                        <span>{model.name}</span>
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {/* Warning if selected model not in list */}
                          {!ollamaError && !ollamaLoading && formData.ollamaModel && ollamaModels.length > 0 && 
                            !ollamaModels.some(m => m.name === formData.ollamaModel) && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-sm">
                              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Model not installed</p>
                                <p className="text-xs mt-1">
                                  Run: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">ollama pull {formData.ollamaModel}</code>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSave} 
                        disabled={!isDirty || isSaving}
                        className="min-w-[120px]"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Storage Tab */}
                {activeTab === 'storage' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">Data & Storage</h2>
                      <p className="text-sm text-stone-500">Configure where your journal entries are saved.</p>
                    </div>
                    <Separator />

                    {/* Vault Path */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Obsidian Vault</CardTitle>
                        <CardDescription>Journal entries are saved as Markdown files in your vault.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="vaultPath">Vault Path</Label>
                          <Input
                            id="vaultPath"
                            placeholder="/Users/you/Documents/Obsidian/MyVault"
                            value={formData.vaultPath || ''}
                            onChange={(e) => updateField('vaultPath', e.target.value)}
                            className={cn(validationErrors.vaultPath && 'border-red-500')}
                          />
                          {validationErrors.vaultPath ? (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {validationErrors.vaultPath}
                            </p>
                          ) : (
                            <p className="text-xs text-stone-500">
                              Entries are saved to: <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">{formData.vaultPath || '...'}/journal/</code>
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Audio Files */}
                    <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base font-medium">Audio Files</CardTitle>
                        <CardDescription>Configure how audio recordings are handled.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Keep Audio Files</Label>
                            <p className="text-xs text-stone-500">
                              Keep original audio files after processing. Stored in <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded">journal/audio/</code>
                            </p>
                          </div>
                          <Switch 
                            checked={formData.keepAudio ?? true}
                            onCheckedChange={(checked: boolean) => updateField('keepAudio', checked)}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSave} 
                        disabled={!isDirty || isSaving}
                        className="min-w-[120px]"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

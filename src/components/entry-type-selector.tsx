'use client';

import { Mic, BookOpen, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { EntryType } from '@/types';

interface EntryTypeSelectorProps {
  value: EntryType;
  onChange: (type: EntryType) => void;
  disabled?: boolean;
}

const entryTypes: { type: EntryType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    type: 'brain-dump',
    label: 'Brain Dump',
    description: 'Free-form voice recording. AI generates a reflection.',
    icon: <Mic className="h-5 w-5" />,
  },
  {
    type: 'daily-reflection',
    label: 'Daily Reflection',
    description: 'Guided prompts: gratitude, accomplishments, challenges, tomorrow.',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    type: 'quick-note',
    label: 'Quick Note',
    description: 'Just transcription, no AI processing.',
    icon: <Zap className="h-5 w-5" />,
  },
];

export function EntryTypeSelector({ value, onChange, disabled }: EntryTypeSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {entryTypes.map(({ type, label, description, icon }) => (
        <Card
          key={type}
          className={`
            cursor-pointer transition-all
            ${value === type ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={() => !disabled && onChange(type)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`
                p-2 rounded-lg
                ${value === type ? 'bg-primary text-primary-foreground' : 'bg-muted'}
              `}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

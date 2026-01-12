'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { PromptAnswers, PromptAnswer } from '@/types';

interface PromptFormProps {
  promptAnswers: PromptAnswers;
  onSave: (answers: PromptAnswers) => void;
  onContinue: () => void;
  isLoading?: boolean;
}

const prompts = [
  {
    key: 'gratitude' as const,
    label: 'Gratitude',
    question: 'What are you grateful for today?',
    placeholder: 'Things you appreciate, moments that brought joy...',
  },
  {
    key: 'accomplishments' as const,
    label: 'Accomplishments',
    question: 'What did you accomplish today?',
    placeholder: 'Tasks completed, progress made, wins big or small...',
  },
  {
    key: 'challenges' as const,
    label: 'Challenges & Lessons',
    question: 'What challenges did you face? What did you learn?',
    placeholder: 'Difficulties encountered, lessons learned, growth moments...',
  },
  {
    key: 'tomorrow' as const,
    label: "Tomorrow's Focus",
    question: 'What do you want to focus on tomorrow?',
    placeholder: 'Priorities, goals, intentions for the next day...',
  },
];

export function PromptForm({ promptAnswers, onSave, onContinue, isLoading }: PromptFormProps) {
  const [answers, setAnswers] = useState<PromptAnswers>(promptAnswers);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setAnswers(promptAnswers);
  }, [promptAnswers]);

  const handleChange = (key: keyof PromptAnswers, text: string) => {
    setAnswers(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        text,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(answers);
    setHasChanges(false);
  };

  const handleContinue = () => {
    if (hasChanges) {
      onSave(answers);
    }
    onContinue();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Reflection Prompts</CardTitle>
        <CardDescription>
          Review and edit the AI-extracted answers, or add your own thoughts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {prompts.map(({ key, label, question, placeholder }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key} className="text-base font-medium">
              {label}
            </Label>
            <p className="text-sm text-muted-foreground">{question}</p>
            <Textarea
              id={key}
              value={answers[key]?.text || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="min-h-[100px]"
              disabled={isLoading}
            />
            {answers[key]?.extractedText && answers[key]?.extractedText !== answers[key]?.text && (
              <p className="text-xs text-muted-foreground">
                AI extracted: {answers[key]?.extractedText?.slice(0, 100)}...
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-4">
          {hasChanges && (
            <Button variant="outline" onClick={handleSave}>
              Save Changes
            </Button>
          )}
          <Button onClick={handleContinue} disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Generate Journal'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

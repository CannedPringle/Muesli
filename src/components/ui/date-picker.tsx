'use client';

import * as React from 'react';
import { format, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerProps {
  /** Date string in YYYY-MM-DD format */
  value: string;
  /** Callback when date changes, receives YYYY-MM-DD string */
  onChange: (date: string) => void;
  /** Optional label shown above the date picker */
  label?: string;
  /** Optional class name for the container */
  className?: string;
  /** Disable the date picker */
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  label,
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Convert YYYY-MM-DD string to Date object for the calendar
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    try {
      return parse(value, 'yyyy-MM-dd', new Date());
    } catch {
      return undefined;
    }
  }, [value]);

  // Format for display: "Jan 12, 2026"
  const displayValue = React.useMemo(() => {
    if (!dateValue) return 'Pick a date';
    return format(dateValue, 'MMM d, yyyy');
  }, [dateValue]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const dateString = format(date, 'yyyy-MM-dd');
      onChange(dateString);
      setOpen(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !dateValue && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

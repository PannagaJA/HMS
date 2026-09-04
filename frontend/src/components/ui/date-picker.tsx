import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  date,
  onSelect,
  placeholder = 'Pick a date',
  className,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-start rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 text-left font-normal focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20',
            !date && 'text-slate-400',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
          {date ? format(date, 'PPP') : <span>{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <DayPicker
          mode="single"
          selected={date}
          onSelect={(d) => {
            onSelect?.(d);
            setOpen(false);
          }}
          className="p-1 text-xs"
        />
      </PopoverContent>
    </Popover>
  );
};

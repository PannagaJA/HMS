import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats time string (e.g. '07:30:00', '19:30', or ISO datetime string) to 12-hour AM/PM format (e.g. '07:30 AM', '07:30 PM').
 */
export function formatTime12(timeStr?: string | null): string {
  if (!timeStr) return '';

  // If it's a full ISO or Date string
  if (timeStr.includes('T') || timeStr.includes('-') && timeStr.length > 8) {
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  // If it's standard HH:mm or HH:mm:ss
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].substring(0, 2);
    if (isNaN(hours)) return timeStr;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const strHours = hours < 10 ? `0${hours}` : `${hours}`;
    return `${strHours}:${minutes} ${ampm}`;
  }

  return timeStr;
}

/**
 * Formats a time range (e.g. '07:30:00', '09:30:00') into '07:30 AM - 09:30 AM'
 */
export function formatTimeRange12(startTime?: string | null, endTime?: string | null): string {
  const start = formatTime12(startTime || '08:00');
  const end = formatTime12(endTime || '10:00');
  return `${start} - ${end}`;
}

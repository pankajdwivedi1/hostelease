/**
 * Universal Date Formatting Utilities for Hosteleaze
 * Standard format required: DD-MM-YYYY (or DD-MM-YYYY, hh:mm A when time is included)
 * Timezone: Asia/Kolkata (IST)
 */

export const parseFlexibleDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    // Pattern 1: DD-MM-YYYY or DD/MM/YYYY with optional time
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      let hours = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0;
      const minutes = ddmmyyyyMatch[5] ? parseInt(ddmmyyyyMatch[5], 10) : 0;
      const seconds = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0;
      const ampm = ddmmyyyyMatch[7]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }

    // Pattern 2: YYYY-MM-DD with optional time
    const yyyymmddMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i);
    if (yyyymmddMatch) {
      const year = parseInt(yyyymmddMatch[1], 10);
      const month = parseInt(yyyymmddMatch[2], 10) - 1;
      const day = parseInt(yyyymmddMatch[3], 10);
      const hours = yyyymmddMatch[4] ? parseInt(yyyymmddMatch[4], 10) : 0;
      const minutes = yyyymmddMatch[5] ? parseInt(yyyymmddMatch[5], 10) : 0;
      const seconds = yyyymmddMatch[6] ? parseInt(yyyymmddMatch[6], 10) : 0;

      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

/**
 * Formats any date input to DD-MM-YYYY (or DD-MM-YYYY, hh:mm A) in Asia/Kolkata timezone.
 */
export const formatToDDMMYYYY = (dateVal: any, includeTime = false): string => {
  if (!dateVal) return "";
  const d = parseFlexibleDate(dateVal);
  if (!d || isNaN(d.getTime())) return String(dateVal);

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: includeTime ? '2-digit' : undefined,
      minute: includeTime ? '2-digit' : undefined,
      hour12: true
    }).formatToParts(d);

    let day = '', month = '', year = '', hour = '', minute = '', dayPeriod = '';
    parts.forEach(p => {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
      else if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    });

    const dateStr = `${day}-${month}-${year}`;
    if (!includeTime || !hour) return dateStr;

    const timeStr = `${hour}:${minute} ${dayPeriod}`;
    return `${dateStr}, ${timeStr}`;
  } catch {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    if (!includeTime) return dateStr;
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${dateStr}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
};

export const formatDateDDMMYYYY = (dateVal: any): string => formatToDDMMYYYY(dateVal, false);
export const formatDateTimeDDMMYYYY = (dateVal: any): string => formatToDDMMYYYY(dateVal, true);

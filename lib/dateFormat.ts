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

    // Helper to pad 2 digits
    const pad = (n: number) => String(n).padStart(2, '0');

    // Pattern 1: ISO 8601 string with T (e.g. 2026-09-12T09:10:00.000Z or 2026-09-12T14:40:00)
    if (/^\d{4}-\d{2}-\d{2}T/i.test(trimmed)) {
      // If it doesn't specify a timezone offset (no Z and no +/- offset), treat it as IST (+05:30)
      const hasTz = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(trimmed);
      const isoStr = hasTz ? trimmed : `${trimmed}+05:30`;
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) return d;
    }

    // Pattern 2: DD-MM-YYYY or DD/MM/YYYY with optional time
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
    if (ddmmyyyyMatch) {
      const day = pad(parseInt(ddmmyyyyMatch[1], 10));
      const month = pad(parseInt(ddmmyyyyMatch[2], 10));
      const year = ddmmyyyyMatch[3];
      let hours = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0;
      const minutes = ddmmyyyyMatch[5] ? pad(parseInt(ddmmyyyyMatch[5], 10)) : '00';
      const seconds = ddmmyyyyMatch[6] ? pad(parseInt(ddmmyyyyMatch[6], 10)) : '00';
      const ampm = ddmmyyyyMatch[7]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      // Construct explicit IST timestamp (+05:30) so host server timezone never drifts the time
      const istIso = `${year}-${month}-${day}T${pad(hours)}:${minutes}:${seconds}+05:30`;
      const d = new Date(istIso);
      if (!isNaN(d.getTime())) return d;
    }

    // Pattern 3: YYYY-MM-DD or YYYY/MM/DD (without T) with optional time
    const yyyymmddMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
    if (yyyymmddMatch) {
      const year = yyyymmddMatch[1];
      const month = pad(parseInt(yyyymmddMatch[2], 10));
      const day = pad(parseInt(yyyymmddMatch[3], 10));
      let hours = yyyymmddMatch[4] ? parseInt(yyyymmddMatch[4], 10) : 0;
      const minutes = yyyymmddMatch[5] ? pad(parseInt(yyyymmddMatch[5], 10)) : '00';
      const seconds = yyyymmddMatch[6] ? pad(parseInt(yyyymmddMatch[6], 10)) : '00';
      const ampm = yyyymmddMatch[7]?.toLowerCase();

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      // Construct explicit IST timestamp (+05:30)
      const istIso = `${year}-${month}-${day}T${pad(hours)}:${minutes}:${seconds}+05:30`;
      const d = new Date(istIso);
      if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

/**
 * Parses any date input strictly as an Indian Standard Time (+05:30) Date.
 */
export const parseAsIST = (dateVal: any): Date | null => {
  return parseFlexibleDate(dateVal);
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

export const formatDateTimeWithSecondsDDMMYYYY = (dateVal: any, is24Hour = false): string => {
  if (!dateVal) return "";
  const d = parseFlexibleDate(dateVal);
  if (!d || isNaN(d.getTime())) return String(dateVal);

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !is24Hour
    }).formatToParts(d);

    let day = '', month = '', year = '', hour = '', minute = '', second = '', dayPeriod = '';
    parts.forEach(p => {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
      else if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'second') second = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    });

    const dateStr = `${day}-${month}-${year}`;
    if (!hour) return dateStr;

    const timeStr = is24Hour ? `${hour}:${minute}:${second}` : `${hour}:${minute}:${second} ${dayPeriod}`.trim();
    return `${dateStr}, ${timeStr}`;
  } catch {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}-${month}-${year}`;
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    if (is24Hour) {
      return `${dateStr}, ${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
    }
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${dateStr}, ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  }
};

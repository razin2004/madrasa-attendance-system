/**
 * Utility for parsing and cleaning attendance correction request reasons.
 * Extracts clean staff justifications and strips out automated security failure details.
 */

export function cleanStaffJustification(rawReason?: string | null): string | null {
  if (!rawReason || !rawReason.trim()) return null;
  const text = rawReason.trim();

  // If it's a pure system string with no custom staff justification
  if (
    (text.startsWith('Unverified punch. Failures:') ||
      text.startsWith('Unverified punch submitted') ||
      text === 'Unverified punch.') &&
    !text.toLowerCase().includes('reason:')
  ) {
    return null;
  }

  // Helper to clean individual reason value (removes quotes, prefixes, failures)
  const cleanSingleVal = (val: string): string | null => {
    let s = val
      .replace(/\(Failures:[^)]*\)/gi, '')
      .replace(/Failures:[^|]*/gi, '')
      .replace(/Unverified punch\.?/gi, '')
      .replace(/(?:Clock[- ]?In|Clock[- ]?Out|Reason):\s*/gi, '')
      .replace(/["']/g, '')
      .replace(/^[|;\s•]+|[|;\s•]+$/g, '')
      .trim();

    if (!s || s.toLowerCase() === 'unverified punch' || s.toLowerCase().startsWith('failures:')) {
      return null;
    }
    return s;
  };

  // 1. Try splitting by "|" or "•" to parse both In & Out parts
  const parts = text.split(/\||\s*•\s*/i);
  let inReason: string | null = null;
  let outReason: string | null = null;

  if (parts.length > 1) {
    for (const part of parts) {
      const isOut = /clock[- ]?out/i.test(part);
      const match =
        part.match(/Reason:\s*["']([^"']+)["']/i) ||
        part.match(/(?:Clock[- ]?In|Clock[- ]?Out):\s*["']?([^"'•\n]+)["']?/i) ||
        part.match(/Reason:\s*([^(|\n]+)/i);

      let extracted: string | null = null;
      if (match && match[1]) {
        extracted = cleanSingleVal(match[1]);
      } else {
        extracted = cleanSingleVal(part);
      }

      if (extracted) {
        if (isOut && !outReason) {
          outReason = extracted;
        } else if (!inReason) {
          inReason = extracted;
        } else if (!outReason) {
          outReason = extracted;
        }
      }
    }

    if (inReason && outReason) {
      if (inReason === outReason) return inReason;
      return `${inReason} • ${outReason}`;
    }
    if (inReason) return inReason;
    if (outReason) return outReason;
  }

  // Single string parsing
  const singleMatch =
    text.match(/Reason:\s*["']([^"']+)["']/i) ||
    text.match(/(?:Clock[- ]?In|Clock[- ]?Out):\s*["']?([^"'•\n]+)["']?/i) ||
    text.match(/Reason:\s*([^(|\n]+)/i);

  if (singleMatch && singleMatch[1]) {
    const cleaned = cleanSingleVal(singleMatch[1]);
    if (cleaned) return cleaned;
  }

  return cleanSingleVal(text);
}

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

  // Split by "| Clock Out:" or "Clock Out:" to parse both Clock In & Clock Out parts
  const parts = text.split(/\|\s*Clock Out:/i);
  const inPart = parts[0] || '';
  const outPart = parts[1] || '';

  // Extract In Reason
  let inReason: string | null = null;
  const inMatch = inPart.match(/Reason:\s*["']([^"']+)["']/i) || inPart.match(/Reason:\s*([^(|\n]+)/i);
  if (inMatch && inMatch[1]) {
    const m = inMatch[1].trim();
    if (m && !m.toLowerCase().startsWith('failures:')) inReason = m;
  }

  // Extract Out Reason
  let outReason: string | null = null;
  if (outPart) {
    const outMatch = outPart.match(/Reason:\s*["']([^"']+)["']/i) || outPart.match(/Reason:\s*([^(|\n]+)/i);
    if (outMatch && outMatch[1]) {
      const m = outMatch[1].trim();
      if (m && !m.toLowerCase().startsWith('failures:')) outReason = m;
    }
  }

  if (inReason && outReason) {
    return `Clock-In: "${inReason}" • Clock-Out: "${outReason}"`;
  }
  if (inReason && outPart) {
    return `Clock-In: "${inReason}"`;
  }
  if (inReason) {
    return inReason;
  }
  if (outReason) {
    return `Clock-Out: "${outReason}"`;
  }

  // Fallback: strip (Failures: ...) from string
  const clean = text
    .replace(/\(Failures:[^)]*\)/gi, '')
    .replace(/Failures:[^|]*/gi, '')
    .replace(/Unverified punch\.?/gi, '')
    .replace(/Reason:\s*/gi, '')
    .replace(/\|\s*Clock Out:\s*/gi, '')
    .replace(/^[|;\s]+|[|;\s]+$/g, '')
    .trim();

  if (!clean || clean.toLowerCase() === 'unverified punch') return null;
  return clean;
}

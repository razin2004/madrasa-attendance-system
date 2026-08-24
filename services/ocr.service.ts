import { hashAadhaar, extractIdLast4 } from '@/lib/security';

export interface OcrExtractedData {
  name: string;
  address: string;
  idDocType: 'AADHAAR' | 'VOTER_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'OTHER';
  idDocLast4: string;
  idDocHash: string; // Deterministic salted hash for duplicate checking
  confidence: {
    name: number;
    address: number;
    idNumber: number;
    overall: number;
  };
  requiresManualReview: boolean;
  rawExtractedSnippet?: string;
}

/**
 * Intelligent ID Document Text Parser & OCR Extraction Service
 * Parses raw text extracted from Government ID documents (Aadhaar, Voter ID, Passport, DL)
 * and calculates field-level confidence metrics.
 */
export function parseIdDocumentText(
  rawText: string,
  organizationSalt: string = 'ShiftGuard_Salt_2026'
): OcrExtractedData {
  const text = rawText.replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let extractedName = '';
  let extractedAddress = '';
  let idDocType: OcrExtractedData['idDocType'] = 'OTHER';
  let rawIdNumber = '';

  let nameConfidence = 60;
  let addressConfidence = 50;
  let idNumberConfidence = 50;

  // 1. Aadhaar 12-Digit Pattern Detection (e.g., "1234 5678 9012" or "123456789012")
  const aadhaarRegex = /\b([2-9][0-9]{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4})\b/;
  const aadhaarMatch = text.match(aadhaarRegex);

  // 2. Voter ID (EPIC) Pattern (e.g. "ABC1234567")
  const voterRegex = /\b([A-Z]{3}[0-9]{7})\b/;
  const voterMatch = text.match(voterRegex);

  // 3. Passport Pattern (e.g. "A1234567")
  const passportRegex = /\b([A-PR-WYa-pr-wy][1-9][0-9]{6})\b/;
  const passportMatch = text.match(passportRegex);

  // 4. Driving License Pattern (e.g. "DL-1420110012345")
  const dlRegex = /\b([A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{11})\b/;
  const dlMatch = text.match(dlRegex);

  if (aadhaarMatch) {
    idDocType = 'AADHAAR';
    rawIdNumber = aadhaarMatch[1].replace(/[\s-]/g, '');
    idNumberConfidence = 95;
  } else if (voterMatch) {
    idDocType = 'VOTER_ID';
    rawIdNumber = voterMatch[1];
    idNumberConfidence = 90;
  } else if (passportMatch) {
    idDocType = 'PASSPORT';
    rawIdNumber = passportMatch[1];
    idNumberConfidence = 90;
  } else if (dlMatch) {
    idDocType = 'DRIVING_LICENSE';
    rawIdNumber = dlMatch[1].replace(/[\s-]/g, '');
    idNumberConfidence = 85;
  } else {
    // Fallback search for any 4+ consecutive digits
    const genericDigits = text.match(/\b([0-9]{4,16})\b/);
    if (genericDigits) {
      rawIdNumber = genericDigits[1];
      idNumberConfidence = 60;
    }
  }

  // 5. Name Extraction Logic
  // Look for lines containing "Name:", "To", or name-like capitalized sequences
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Explicit Label match
    if (/(?:Name|Name\s*:|To\s*:|Holder\s*:)\s*(.+)/i.test(line)) {
      const match = line.match(/(?:Name|Name\s*:|To\s*:|Holder\s*:)\s*(.+)/i);
      if (match && match[1].trim().length > 2) {
        extractedName = cleanName(match[1]);
        nameConfidence = 90;
        break;
      }
    }

    // Header skip & look for person name format (2-4 capitalized words, no numbers)
    if (
      !extractedName &&
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line) &&
      !/(?:Government|India|Unique|Authority|Identity|Department|Republic|Card|Election)/i.test(line)
    ) {
      extractedName = cleanName(line);
      nameConfidence = 80;
    }
  }

  // Fallback name if none found
  if (!extractedName && lines.length > 0) {
    for (const line of lines) {
      if (
        line.length >= 3 &&
        !/\d/.test(line) &&
        !/(?:Government|India|Unique|Authority|Identity|Card|Aadhaar|Male|Female|DOB|Birth)/i.test(line)
      ) {
        extractedName = cleanName(line);
        nameConfidence = 65;
        break;
      }
    }
  }

  // 6. Address Extraction Logic
  const addressKeywords = /(?:Address|Address\s*:|S\/O|D\/O|W\/O|C\/O|House|Street|Road|Village|Dist|Pin|Pincode)/i;
  const addressLines: string[] = [];

  let capturingAddress = false;
  for (const line of lines) {
    if (addressKeywords.test(line)) {
      capturingAddress = true;
    }
    if (capturingAddress) {
      // Exclude numbers that look like pure Aadhaar numbers
      if (!/^[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/.test(line)) {
        addressLines.push(line.replace(/^(?:Address\s*:|Address)\s*/i, ''));
      }
      if (addressLines.length >= 3) break;
    }
  }

  if (addressLines.length > 0) {
    extractedAddress = addressLines.join(', ').trim();
    addressConfidence = 85;
  } else {
    // If no explicit address label, take lines with comma or road indicators
    const candidateLines = lines.filter((l) => /,\s*|[0-9]{6}/.test(l));
    if (candidateLines.length > 0) {
      extractedAddress = candidateLines.slice(0, 2).join(', ');
      addressConfidence = 65;
    }
  }

  // Compute Overall Confidence
  const overallConfidence = Math.round(
    (nameConfidence * 0.4) + (addressConfidence * 0.3) + (idNumberConfidence * 0.3)
  );

  const requiresManualReview =
    overallConfidence < 75 ||
    !extractedName ||
    !rawIdNumber ||
    nameConfidence < 70;

  const idDocLast4 = extractIdLast4(rawIdNumber || '0000');
  const idDocHash = hashAadhaar(rawIdNumber || '0000', organizationSalt);

  return {
    name: extractedName,
    address: extractedAddress,
    idDocType,
    idDocLast4,
    idDocHash,
    confidence: {
      name: nameConfidence,
      address: addressConfidence,
      idNumber: idNumberConfidence,
      overall: overallConfidence,
    },
    requiresManualReview,
    rawExtractedSnippet: lines.slice(0, 5).join(' | '),
  };
}

function cleanName(name: string): string {
  return name
    .replace(/[^a-zA-Z\s.'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

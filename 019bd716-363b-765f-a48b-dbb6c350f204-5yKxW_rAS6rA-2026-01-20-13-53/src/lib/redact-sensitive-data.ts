/**
 * Client-side redaction utility for sensitive data
 * Runs entirely in the browser - no external backend
 * CRITICAL: Raw PII must NEVER leave the user's browser
 */

import type { CountryMode } from './state/tax-store';

// Indian PAN pattern: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
const INDIAN_PAN_PATTERN = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;

// US SSN pattern: XXX-XX-XXXX (e.g., 123-45-6789)
const US_SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

// Indian Aadhaar: exactly 12 digits, often with spaces (XXXX XXXX XXXX)
// More strict pattern to avoid false positives
const AADHAAR_PATTERN = /\b\d{4}\s\d{4}\s\d{4}\b/g;

export interface RedactionResult {
  cleanedText: string;
  redactedItems: {
    type: 'PAN' | 'SSN' | 'AADHAAR';
    count: number;
  }[];
  totalRedactions: number;
}

/**
 * Redacts sensitive information from text based on country mode
 * MUST be called before sending any data externally
 * Uses specific placeholders as per security requirements
 */
export function redactSensitiveData(
  text: string,
  countryMode: CountryMode = 'india'
): RedactionResult {
  let cleanedText = text;
  const redactedItems: RedactionResult['redactedItems'] = [];

  if (countryMode === 'india') {
    // Indian mode: Redact PAN and Aadhaar

    // Count and redact Indian PANs with [REDACTED_PAN] placeholder
    const panMatches = cleanedText.match(INDIAN_PAN_PATTERN);
    if (panMatches && panMatches.length > 0) {
      redactedItems.push({ type: 'PAN', count: panMatches.length });
      cleanedText = cleanedText.replace(INDIAN_PAN_PATTERN, '[REDACTED_PAN]');
    }

    // Count and redact Aadhaar numbers (only for India)
    const aadhaarMatches = cleanedText.match(AADHAAR_PATTERN);
    if (aadhaarMatches && aadhaarMatches.length > 0) {
      redactedItems.push({ type: 'AADHAAR', count: aadhaarMatches.length });
      cleanedText = cleanedText.replace(AADHAAR_PATTERN, '[REDACTED_AADHAAR]');
    }
  } else {
    // US mode: Only redact SSN

    // Count and redact US SSNs with [REDACTED_SSN] placeholder
    const ssnMatches = cleanedText.match(US_SSN_PATTERN);
    if (ssnMatches && ssnMatches.length > 0) {
      redactedItems.push({ type: 'SSN', count: ssnMatches.length });
      cleanedText = cleanedText.replace(US_SSN_PATTERN, '[REDACTED_SSN]');
    }
  }

  const totalRedactions = redactedItems.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return {
    cleanedText,
    redactedItems,
    totalRedactions,
  };
}

/**
 * Validates that text has been properly redacted
 * Returns true if no sensitive patterns are found
 */
export function validateRedaction(text: string, countryMode: CountryMode = 'india'): boolean {
  if (countryMode === 'india') {
    const hasPAN = INDIAN_PAN_PATTERN.test(text);
    INDIAN_PAN_PATTERN.lastIndex = 0;
    return !hasPAN;
  } else {
    const hasSSN = US_SSN_PATTERN.test(text);
    US_SSN_PATTERN.lastIndex = 0;
    return !hasSSN;
  }
}

/**
 * Country detection based on phone number patterns
 * This provides a best-guess country code based on phone number formatting
 */

interface PhoneCountryMapping {
  pattern: RegExp;
  country: string;
  priority: number; // Higher numbers = higher priority when multiple matches
}

// Phone number patterns for country detection
// Ordered by specificity and common usage
const PHONE_COUNTRY_PATTERNS: PhoneCountryMapping[] = [
  // United Kingdom
  { pattern: /^\+44|^44|^0[1-9]/, country: 'GB', priority: 100 },
  
  // United States & Canada (harder to distinguish, US more common)
  { pattern: /^\+1|^1[2-9]/, country: 'US', priority: 90 },
  
  // Germany  
  { pattern: /^\+49|^49|^0[1-9]/, country: 'DE', priority: 95 },
  
  // France
  { pattern: /^\+33|^33|^0[1-9]/, country: 'FR', priority: 95 },
  
  // Australia
  { pattern: /^\+61|^61|^0[2-9]/, country: 'AU', priority: 95 },
  
  // Netherlands
  { pattern: /^\+31|^31|^0[1-9]/, country: 'NL', priority: 85 },
  
  // Belgium
  { pattern: /^\+32|^32|^0[1-9]/, country: 'BE', priority: 85 },
  
  // Switzerland
  { pattern: /^\+41|^41|^0[1-9]/, country: 'CH', priority: 85 },
  
  // Austria
  { pattern: /^\+43|^43|^0[1-9]/, country: 'AT', priority: 85 },
  
  // Sweden
  { pattern: /^\+46|^46|^0[1-9]/, country: 'SE', priority: 85 },
  
  // Norway
  { pattern: /^\+47|^47|^[2-9]/, country: 'NO', priority: 85 },
  
  // Denmark
  { pattern: /^\+45|^45|^[2-9]/, country: 'DK', priority: 85 },
  
  // Italy
  { pattern: /^\+39|^39|^3[0-9]/, country: 'IT', priority: 80 },
  
  // Spain
  { pattern: /^\+34|^34|^[6-9]/, country: 'ES', priority: 80 },
  
  // Portugal
  { pattern: /^\+351|^351|^9[1-3]/, country: 'PT', priority: 80 },
  
  // Japan
  { pattern: /^\+81|^81|^0[1-9]/, country: 'JP', priority: 75 },
  
  // South Korea
  { pattern: /^\+82|^82|^0[1-9]/, country: 'KR', priority: 75 },
  
  // Singapore
  { pattern: /^\+65|^65|^[689]/, country: 'SG', priority: 75 },
  
  // New Zealand
  { pattern: /^\+64|^64|^0[2-9]/, country: 'NZ', priority: 75 },
  
  // Ireland
  { pattern: /^\+353|^353|^0[1-9]/, country: 'IE', priority: 70 },
  
  // Finland
  { pattern: /^\+358|^358|^0[1-9]/, country: 'FI', priority: 70 },
];

/**
 * Detect country code from phone number
 * Returns the most likely country code based on phone number pattern
 */
export function detectCountryFromPhone(phone?: string): string | null {
  if (!phone) return null;
  
  // Clean the phone number (remove spaces, dashes, etc.)
  const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (!cleanedPhone || cleanedPhone.length < 4) return null;
  
  // Find all matching patterns
  const matches = PHONE_COUNTRY_PATTERNS
    .filter(mapping => mapping.pattern.test(cleanedPhone))
    .sort((a, b) => b.priority - a.priority);
  
  // Return the highest priority match
  return matches.length > 0 ? matches[0].country : null;
}

/**
 * Get display name for country code
 */
export function getCountryDisplayName(countryCode: string): string {
  const countryNames: Record<string, string> = {
    'GB': 'United Kingdom',
    'US': 'United States',
    'CA': 'Canada',
    'DE': 'Germany',
    'FR': 'France',
    'AU': 'Australia',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'IT': 'Italy',
    'ES': 'Spain',
    'PT': 'Portugal',
    'JP': 'Japan',
    'KR': 'South Korea',
    'SG': 'Singapore',
    'NZ': 'New Zealand',
    'IE': 'Ireland',
    'FI': 'Finland',
  };
  
  return countryNames[countryCode] || countryCode;
}

/**
 * Get flag emoji for country code
 */
export function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    'GB': '🇬🇧',
    'US': '🇺🇸',
    'CA': '🇨🇦',
    'DE': '🇩🇪',
    'FR': '🇫🇷',
    'AU': '🇦🇺',
    'NL': '🇳🇱',
    'BE': '🇧🇪',
    'CH': '🇨🇭',
    'AT': '🇦🇹',
    'SE': '🇸🇪',
    'NO': '🇳🇴',
    'DK': '🇩🇰',
    'IT': '🇮🇹',
    'ES': '🇪🇸',
    'PT': '🇵🇹',
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'SG': '🇸🇬',
    'NZ': '🇳🇿',
    'IE': '🇮🇪',
    'FI': '🇫🇮',
  };
  
  return flags[countryCode] || '🌍';
}

/**
 * Validate if a country code is supported
 */
export function isSupportedCountry(countryCode: string, supportedCountries: string[]): boolean {
  return supportedCountries.includes(countryCode);
}

/**
 * Get default country preference from user profile
 */
export function getDefaultCountry(phone?: string, fallback: string = 'GB'): string {
  const detected = detectCountryFromPhone(phone);
  return detected || fallback;
}
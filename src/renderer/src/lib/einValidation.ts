/**
 * Represents a business type.
 */
export type BusinessType = 'LLC' | 'Corporation' | 'Partnership' | 'Sole Proprietorship' | 'Nonprofit' | 'Other';

/**
 * List of valid business types.
 */
export const BUSINESS_TYPES: readonly BusinessType[] = [
  'LLC',
  'Corporation',
  'Partnership',
  'Sole Proprietorship',
  'Nonprofit',
  'Other'
];

/**
 * Validates a US EIN format (##-#######).
 * @param ein - The EIN to validate.
 * @returns true if the EIN is valid, false otherwise.
 */
export function isValidEIN(ein: string): boolean {
  const einRegex = /^\d{2}-?\d{7}$/;
  return einRegex.test(ein);
}

/**
 * Normalizes a US EIN format (##-#######).
 * @param ein - The EIN to normalize.
 * @returns The normalized EIN or the original if not valid.
 */
export function normalizeEIN(ein: string): string {
  const cleaned = ein.replace(/\D/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  }
  return ein;
}

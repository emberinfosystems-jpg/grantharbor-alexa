/**
 * Represents an investor.
 */
export interface Inv {
  name: string;
  focus_areas: string[];
  stage?: string;
  typical_check_min?: number;
  typical_check_max?: number;
}

/**
 * Filters investors based on search criteria.
 * @param items - Array of investors to filter.
 * @param search - Search term for the investor's name or focus areas.
 * @param stage - Stage of the investor ('all' or specific stage).
 * @param minCheck - Minimum typical check amount (inclusive).
 * @returns Filtered array of investors.
 */
export function filterInvestors<T extends Inv>(items: T[], search: string, stage: string | 'all', minCheck?: number): T[] {
  return items.filter(item => {
    const searchLower = search.toLowerCase();
    if (!item.name.toLowerCase().includes(searchLower) && !item.focus_areas.some(area => area.toLowerCase().includes(searchLower))) {
      return false;
    }
    if (stage !== 'all' && item.stage !== stage) {
      return false;
    }
    if (minCheck !== undefined) {
      const maxCheck = item.typical_check_max ?? item.typical_check_min;
      if (maxCheck === undefined) {
        return false;
      }
      if (maxCheck < minCheck) {
        return false;
      }
    }
    return true;
  });
}

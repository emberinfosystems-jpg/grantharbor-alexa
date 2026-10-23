/**
 * Represents a generic item that can be sorted.
 */
export type SortDir = 'asc' | 'desc';

/**
 * Sorts an array of items by a specified key and direction.
 * @param items - The array of items to sort.
 * @param key - The key to sort the items by.
 * @param dir - The direction to sort the items in ('asc' or 'desc').
 * @returns A new stably-sorted array of items.
 */
export function sortByKey<T>(items: T[], key: keyof T, dir: SortDir): T[] {
  return [...items].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    if (valA === undefined || valB === undefined) {
      return valA === undefined ? -1 : 1;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return dir === 'asc' ? valA - valB : valB - valA;
    } else if (typeof valA === 'string' && typeof valB === 'string') {
      const aStr = valA.toLowerCase();
      const bStr = valB.toLowerCase();
      return dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    }

    throw new Error(`Unsupported type for sorting: ${typeof valA}`);
  });
}

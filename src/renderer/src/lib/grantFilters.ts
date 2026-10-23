/**
 * Filters grants based on search criteria.
 * @param grants - Array of grants to filter.
 * @param search - Substring to search for in title, source_agency, and description.
 * @param status - Status to filter by, or 'All' to include all statuses.
 * @param categories - Categories to filter by, or empty array to include all categories.
 * @returns Filtered array of grants.
 */
export function filterGrants<T extends { title: string; source_agency: string; description: string; status: string; categories: string[] }>(grants: T[], search: string, status: string | 'All', categories: string[]): T[] {
  const lowerSearch = search.toLowerCase();
  return grants.filter(grant => {
    const matchesSearch = grant.title.toLowerCase().includes(lowerSearch) || 
                         grant.source_agency.toLowerCase().includes(lowerSearch) || 
                         grant.description.toLowerCase().includes(lowerSearch);
    const matchesStatus = status === 'All' || grant.status === status;
    const matchesCategories = categories.length === 0 || grant.categories.some(category => categories.includes(category));
    return matchesSearch && matchesStatus && matchesCategories;
  });
}

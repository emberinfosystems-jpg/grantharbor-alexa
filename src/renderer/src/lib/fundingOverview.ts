/**
 * Represents a funding grant.
 */
export interface G {
  funding_amount: number;
  status: string;
}

/**
 * Represents an overview of funding grants.
 */
export interface FundingOverview {
  totalTracked: number;
  awarded: number;
  pending: number;
  countByStatus: Record<string, number>;
}

/**
 * Calculates the funding overview based on a list of grants.
 * @param grants - The list of grants to calculate the overview for.
 * @returns The funding overview.
 */
export function fundingOverview(grants: G[]): FundingOverview {
  const totalTracked = grants.reduce((acc, grant) => acc + grant.funding_amount, 0);
  const awarded = grants.filter(grant => grant.status === 'Awarded').reduce((acc, grant) => acc + grant.funding_amount, 0);
  const pending = grants.filter(grant => ['New', 'Reviewed', 'Applied'].includes(grant.status)).reduce((acc, grant) => acc + grant.funding_amount, 0);
  const countByStatus: Record<string, number> = grants.reduce((acc, grant) => {
    acc[grant.status] = (acc[grant.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { totalTracked, awarded, pending, countByStatus };
}

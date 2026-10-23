/**
 * Represents a grant with a title, deadline, and status.
 */
export interface G {
  title: string;
  deadline: string;
  status: string;
}

/**
 * Represents an upcoming deadline with a title and days until the deadline.
 */
export interface Upcoming {
  title: string;
  daysUntil: number;
}

/**
 * Returns an array of upcoming deadlines for non-terminal grants (status not Awarded/Rejected/Expired)
 * whose deadline is between today and today+withinDays inclusive, sorted by daysUntil asc.
 * @param grants - Array of grants to filter and process.
 * @param today - The current date in ISO yyyy-mm-dd format.
 * @param withinDays - The number of days to look ahead for upcoming deadlines.
 * @returns An array of Upcoming objects.
 */
export function upcomingDeadlines(grants: G[], today: string, withinDays: number): Upcoming[] {
  const todayDate = new Date(today);
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + withinDays);

  return grants
    .filter(grant => grant.status !== 'Awarded' && grant.status !== 'Rejected' && grant.status !== 'Expired')
    .map(grant => {
      const deadlineDate = new Date(grant.deadline);
      if (deadlineDate >= todayDate && deadlineDate <= futureDate) {
        return {
          title: grant.title,
          daysUntil: Math.ceil((deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
        };
      }
      return null;
    })
    .filter(upcoming => upcoming !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Represents the status of a grant.
 */
export type GrantStatus = 'New' | 'Reviewed' | 'Applied' | 'Awarded' | 'Rejected' | 'Expired';

/**
 * The columns for the grant board.
 */
export const BOARD_COLUMNS: readonly GrantStatus[] = ['New', 'Reviewed', 'Applied', 'Awarded', 'Rejected', 'Expired'];

/**
 * Represents the style for a grant status.
 */
export interface StatusStyle {
  label: string;
  color: string;
}

/**
 * Maps each grant status to its corresponding label and color.
 * @param s - The grant status.
 * @returns The style for the given grant status.
 */
export function statusStyle(s: GrantStatus): StatusStyle {
  switch (s) {
    case 'New':
      return { label: 'New', color: '#FFD700' };
    case 'Reviewed':
      return { label: 'Reviewed', color: '#FFFF00' };
    case 'Applied':
      return { label: 'Applied', color: '#ADD8E6' };
    case 'Awarded':
      return { label: 'Awarded', color: '#90EE90' };
    case 'Rejected':
      return { label: 'Rejected', color: '#FF4500' };
    case 'Expired':
      return { label: 'Expired', color: '#FF6347' };
  }
}

/**
 * Determines if a grant status is terminal.
 * @param s - The grant status.
 * @returns True if the status is terminal, false otherwise.
 */
export function isTerminal(s: GrantStatus): boolean {
  return ['Awarded', 'Rejected', 'Expired'].includes(s);
}

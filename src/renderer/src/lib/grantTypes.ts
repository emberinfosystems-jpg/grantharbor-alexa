/**
 * Represents the status of a grant.
 */
export type GrantStatus = 'New' | 'Reviewed' | 'Applied' | 'Awarded' | 'Rejected' | 'Expired';

/**
 * Represents a grant application.
 */
export interface Grant {
  id: string;
  title: string;
  description: string;
  funding_amount: number;
  deadline: string;
  source_agency: string;
  link_url?: string;
  categories: string[];
  status: GrantStatus;
  notes?: string;
  confirmation_number?: string;
  submitted_date?: string;
  expected_response_date?: string;
}

/** Trusted email / domain that grant alerts may arrive from. */
export interface ApprovedSender {
  id: string;
  email_or_domain: string;
  sender_name?: string;
  sender_type: 'email' | 'domain';
  notes?: string;
}

/** Reusable business profile used to fill out applications. */
export interface ApplicationProfile {
  id: string;
  profile_name: string;
  applicant_name?: string;
  email?: string;
  phone?: string;
  business_name?: string;
  business_type?: string;
  ein?: string;
  industry?: string;
  annual_revenue?: number;
  employees?: number;
  mission_statement?: string;
  funding_needed?: number;
  funding_purpose?: string;
}

/** Per-user notification preferences (one record per account). */
export interface UserPreference {
  id: string;
  notify_email?: boolean;
  notify_in_app?: boolean;
  email_frequency?: 'instant' | 'daily' | 'weekly';
  preferred_categories?: string[];
}

/**
 * Represents the type of an investor.
 */
export type InvestorType = 'venture_capital' | 'angel';

/**
 * Represents an investor in a grant program.
 */
export interface Investor {
  id: string;
  name: string;
  investor_type: InvestorType;
  focus_areas: string[];
  stage?: string;
  typical_check_min?: number;
  typical_check_max?: number;
  // 2026-08-24: these five WERE already in the PocketBase schema
  // (pocketbase/setup-collections.mjs `investors`), already written by the Investors
  // form, and already set by curatedInvestors — the interface was simply stale.
  // It typechecked as 13 errors while the app worked, which is the bad direction:
  // the type lied about the model, so tsc could not be trusted as the oracle here.
  fund_size?: number;
  location?: string;
  website_url?: string;
  description?: string;
  portfolio_examples?: string[];
  is_active: boolean;
}

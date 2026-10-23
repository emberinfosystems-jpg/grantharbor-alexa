import type { Investor } from './grantTypes'

// Curated, built-in investor library shipped with the free tier (static — not the
// user's backend data). The user's own additions ("watchlist") come from the
// investors collection and render alongside these. Pro tier = the fuller,
// auto-updating list. Names/figures adapted from the GrantGuard reference set.
export const CURATED_INVESTORS: Investor[] = [
  {
    id: 'cur-vc-1', name: 'Sequoia Capital', investor_type: 'venture_capital',
    focus_areas: ['Consumer', 'Enterprise', 'Healthcare', 'Fintech'], stage: 'Seed to IPO',
    typical_check_min: 1_000_000, typical_check_max: 100_000_000, location: 'Menlo Park, CA',
    website_url: 'https://www.sequoiacap.com', is_active: true,
    description: 'Legendary venture firm backing founders from idea through every stage of growth.'
  },
  {
    id: 'cur-vc-2', name: 'Andreessen Horowitz', investor_type: 'venture_capital',
    focus_areas: ['Software', 'Crypto', 'Bio', 'Fintech', 'AI'], stage: 'Seed to Growth',
    typical_check_min: 1_000_000, typical_check_max: 50_000_000, location: 'Menlo Park, CA',
    website_url: 'https://a16z.com', is_active: true,
    description: 'Multistage venture capital firm investing in bold visionaries building the future through technology.'
  },
  {
    id: 'cur-vc-3', name: 'Y Combinator', investor_type: 'venture_capital',
    focus_areas: ['All Sectors', 'Software', 'Consumer', 'Deep Tech', 'Bio'], stage: 'Seed / Accelerator',
    typical_check_min: 125_000, typical_check_max: 500_000, location: 'Mountain View, CA',
    website_url: 'https://www.ycombinator.com', is_active: true,
    description: 'Top startup accelerator providing seed funding, mentorship, and a 3-month program. Over 4,000 startups since 2005.'
  },
  {
    id: 'cur-an-1', name: 'Keiretsu Forum', investor_type: 'angel',
    focus_areas: ['Diverse', 'Technology', 'Healthcare', 'Real Estate', 'Consumer'], stage: 'Seed / Series A',
    typical_check_min: 250_000, typical_check_max: 2_000_000, location: 'Multi-location (Global)',
    website_url: 'https://www.keiretsuforum.com', is_active: true,
    description: "World's largest angel investor network with 50+ chapters globally. Members invest across diverse sectors and stages."
  },
  {
    id: 'cur-an-2', name: 'Harvard Angels', investor_type: 'angel',
    focus_areas: ['Technology', 'Consumer', 'Healthcare', 'Enterprise'], stage: 'Seed / Early Stage',
    typical_check_min: 100_000, typical_check_max: 500_000, location: 'Multi-location (US)',
    website_url: 'https://www.harvardangels.com', is_active: true,
    description: 'Angel investor group of Harvard alumni investing in early-stage companies across technology, healthcare, and consumer sectors.'
  },
  {
    id: 'cur-an-3', name: 'Golden Seeds', investor_type: 'angel',
    focus_areas: ['Women-led Businesses', 'Technology', 'Consumer', 'Healthcare'], stage: 'Seed / Early Stage',
    typical_check_min: 250_000, typical_check_max: 1_000_000, location: 'New York, NY',
    website_url: 'https://www.goldenseeds.com', is_active: true,
    description: 'Angel investment network dedicated to investing in women-led companies. Active across multiple chapters nationwide.'
  }
]

// A broad, practical list for a global sign-up form — not the full ISO-3166 set.
export const countries = [
  'Ghana', 'Nigeria', 'United States', 'United Kingdom', 'Canada', 'South Africa', 'Kenya',
  'Egypt', 'Morocco', 'Ivory Coast', "Cote d'Ivoire", 'Senegal', 'Cameroon', 'Ethiopia', 'Tanzania',
  'Uganda', 'Rwanda', 'India', 'Pakistan', 'Bangladesh', 'China', 'Japan', 'South Korea',
  'Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'United Arab Emirates', 'Saudi Arabia',
  'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Portugal', 'Ireland',
  'Sweden', 'Norway', 'Denmark', 'Poland', 'Switzerland', 'Australia', 'New Zealand',
  'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Jamaica', 'Trinidad and Tobago',
  'Other',
].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))

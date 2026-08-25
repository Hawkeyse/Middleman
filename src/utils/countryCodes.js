// International dial codes for the signup phone field. iso2 doubles as the
// flag emoji source (regional indicator symbols, computed rather than
// hand-typed so there's no risk of a mismatched flag/country).
function flagEmoji(iso2) {
  return iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

const RAW = [
  ['US', 'United States', '1'], ['CA', 'Canada', '1'], ['GB', 'United Kingdom', '44'],
  ['GH', 'Ghana', '233'], ['NG', 'Nigeria', '234'], ['KE', 'Kenya', '254'], ['ZA', 'South Africa', '27'],
  ['EG', 'Egypt', '20'], ['ET', 'Ethiopia', '251'], ['TZ', 'Tanzania', '255'], ['UG', 'Uganda', '256'],
  ['DZ', 'Algeria', '213'], ['AO', 'Angola', '244'], ['BJ', 'Benin', '229'], ['BW', 'Botswana', '267'],
  ['BF', 'Burkina Faso', '226'], ['BI', 'Burundi', '257'], ['CM', 'Cameroon', '237'], ['CV', 'Cape Verde', '238'],
  ['CF', 'Central African Republic', '236'], ['TD', 'Chad', '235'], ['KM', 'Comoros', '269'],
  ['CG', 'Congo', '242'], ['CD', 'DR Congo', '243'], ['DJ', 'Djibouti', '253'], ['GQ', 'Equatorial Guinea', '240'],
  ['ER', 'Eritrea', '291'], ['SZ', 'Eswatini', '268'], ['GA', 'Gabon', '241'], ['GM', 'Gambia', '220'],
  ['GN', 'Guinea', '224'], ['GW', 'Guinea-Bissau', '245'], ['CI', "Ivory Coast", '225'], ['LS', 'Lesotho', '266'],
  ['LR', 'Liberia', '231'], ['LY', 'Libya', '218'], ['MG', 'Madagascar', '261'], ['MW', 'Malawi', '265'],
  ['ML', 'Mali', '223'], ['MR', 'Mauritania', '222'], ['MU', 'Mauritius', '230'], ['MA', 'Morocco', '212'],
  ['MZ', 'Mozambique', '258'], ['NA', 'Namibia', '264'], ['NE', 'Niger', '227'], ['RW', 'Rwanda', '250'],
  ['ST', 'Sao Tome and Principe', '239'], ['SN', 'Senegal', '221'], ['SC', 'Seychelles', '248'],
  ['SL', 'Sierra Leone', '232'], ['SO', 'Somalia', '252'], ['SS', 'South Sudan', '211'], ['SD', 'Sudan', '249'],
  ['TG', 'Togo', '228'], ['TN', 'Tunisia', '216'], ['ZM', 'Zambia', '260'], ['ZW', 'Zimbabwe', '263'],
  ['FR', 'France', '33'], ['DE', 'Germany', '49'], ['IT', 'Italy', '39'], ['ES', 'Spain', '34'],
  ['PT', 'Portugal', '351'], ['NL', 'Netherlands', '31'], ['BE', 'Belgium', '32'], ['CH', 'Switzerland', '41'],
  ['AT', 'Austria', '43'], ['SE', 'Sweden', '46'], ['NO', 'Norway', '47'], ['DK', 'Denmark', '45'],
  ['FI', 'Finland', '358'], ['IE', 'Ireland', '353'], ['PL', 'Poland', '48'], ['CZ', 'Czechia', '420'],
  ['SK', 'Slovakia', '421'], ['HU', 'Hungary', '36'], ['RO', 'Romania', '40'], ['BG', 'Bulgaria', '359'],
  ['GR', 'Greece', '30'], ['TR', 'Turkey', '90'], ['UA', 'Ukraine', '380'], ['RU', 'Russia', '7'],
  ['HR', 'Croatia', '385'], ['SI', 'Slovenia', '386'], ['RS', 'Serbia', '381'], ['LT', 'Lithuania', '370'],
  ['LV', 'Latvia', '371'], ['EE', 'Estonia', '372'], ['IS', 'Iceland', '354'], ['LU', 'Luxembourg', '352'],
  ['MT', 'Malta', '356'], ['CY', 'Cyprus', '357'], ['AL', 'Albania', '355'], ['MK', 'North Macedonia', '389'],
  ['BA', 'Bosnia and Herzegovina', '387'], ['ME', 'Montenegro', '382'], ['MD', 'Moldova', '373'],
  ['BY', 'Belarus', '375'], ['GE', 'Georgia', '995'], ['AM', 'Armenia', '374'], ['AZ', 'Azerbaijan', '994'],
  ['CN', 'China', '86'], ['JP', 'Japan', '81'], ['KR', 'South Korea', '82'], ['IN', 'India', '91'],
  ['PK', 'Pakistan', '92'], ['BD', 'Bangladesh', '880'], ['LK', 'Sri Lanka', '94'], ['NP', 'Nepal', '977'],
  ['ID', 'Indonesia', '62'], ['MY', 'Malaysia', '60'], ['SG', 'Singapore', '65'], ['PH', 'Philippines', '63'],
  ['TH', 'Thailand', '66'], ['VN', 'Vietnam', '84'], ['MM', 'Myanmar', '95'], ['KH', 'Cambodia', '855'],
  ['LA', 'Laos', '856'], ['TW', 'Taiwan', '886'], ['HK', 'Hong Kong', '852'], ['MO', 'Macau', '853'],
  ['MN', 'Mongolia', '976'], ['KZ', 'Kazakhstan', '7'], ['UZ', 'Uzbekistan', '998'], ['AF', 'Afghanistan', '93'],
  ['SA', 'Saudi Arabia', '966'], ['AE', 'United Arab Emirates', '971'], ['QA', 'Qatar', '974'],
  ['KW', 'Kuwait', '965'], ['BH', 'Bahrain', '973'], ['OM', 'Oman', '968'], ['JO', 'Jordan', '962'],
  ['LB', 'Lebanon', '961'], ['IQ', 'Iraq', '964'], ['IR', 'Iran', '98'], ['IL', 'Israel', '972'],
  ['PS', 'Palestine', '970'], ['YE', 'Yemen', '967'], ['SY', 'Syria', '963'],
  ['AU', 'Australia', '61'], ['NZ', 'New Zealand', '64'], ['FJ', 'Fiji', '679'], ['PG', 'Papua New Guinea', '675'],
  ['MX', 'Mexico', '52'], ['BR', 'Brazil', '55'], ['AR', 'Argentina', '54'], ['CL', 'Chile', '56'],
  ['CO', 'Colombia', '57'], ['PE', 'Peru', '51'], ['VE', 'Venezuela', '58'], ['EC', 'Ecuador', '593'],
  ['BO', 'Bolivia', '591'], ['PY', 'Paraguay', '595'], ['UY', 'Uruguay', '598'], ['CR', 'Costa Rica', '506'],
  ['PA', 'Panama', '507'], ['GT', 'Guatemala', '502'], ['HN', 'Honduras', '504'], ['SV', 'El Salvador', '503'],
  ['NI', 'Nicaragua', '505'], ['CU', 'Cuba', '53'], ['DO', 'Dominican Republic', '1'], ['JM', 'Jamaica', '1'],
  ['TT', 'Trinidad and Tobago', '1'], ['HT', 'Haiti', '509'], ['BS', 'Bahamas', '1'], ['BB', 'Barbados', '1'],
]

export const COUNTRY_CODES = RAW
  .map(([iso2, name, dial]) => ({ iso2, name, dial: `+${dial}`, flag: flagEmoji(iso2) }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const DEFAULT_COUNTRY = COUNTRY_CODES.find((c) => c.iso2 === 'GH')

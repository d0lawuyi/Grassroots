/*
 * Grassroots "Clubhouse" palette: cream ground, forest green, clay accent.
 *
 * The token names are kept from the original dark theme so every screen
 * picks up the new look without renaming. Read them as roles:
 *   ink       page background (and text placed on a primary button)
 *   snow      main text
 *   primary   brand forest green: buttons, active states, accent text
 */
export const COLORS = {
  /* core palette */
  ink:        '#F4F0E6', // cream page background
  inkRaised:  '#FFFDF8', // raised surface: inputs, sheets, tab bar
  cardFill:   '#FFFDF8', // cards
  lime:       '#17442F', // legacy name, now forest
  limeDim:    'rgba(23,68,47,0.10)',
  snow:       '#172019', // main text
  mute:       '#59625B', // secondary text
  faint:      '#7E867F', // placeholders, tertiary text
  line:       'rgba(23,32,25,0.12)',

  /* brand */
  forest:        '#17442F',
  forestDeep:    '#0E2E1F',
  clay:          '#B9441B',
  clayLight:     'rgba(185,68,27,0.12)',
  sage:          '#D5E2D0',

  /* primary / accent */
  primary:       '#17442F',
  primaryLight:  'rgba(23,68,47,0.14)',
  primaryDark:   '#0E2E1F',
  accent:        '#B9441B',
  softGreen:     'rgba(23,68,47,0.10)',
  paleGreen:     'rgba(23,68,47,0.06)',
  soil:          'rgba(23,68,47,0.14)',
  soilDark:      'rgba(23,68,47,0.08)',
  field:         '#17442F',
  fieldLight:    '#D5E2D0',

  /* text */
  text:   '#172019',
  muted:  '#59625B',
  white:  '#FFFDF8',
  black:  '#172019',

  /* canvas */
  canvasTop:     '#F4F0E6',
  canvasMid:     '#F1ECE0',
  canvasBottom:  '#F4F0E6',
  gradientStart: '#F4F0E6',
  gradientMid:   '#EEF3EA',
  gradientEnd:   '#F4F0E6',
  card:          '#FFFDF8',
  border:        'rgba(23,32,25,0.12)',

  /* neutral ramp: light ground, dark ink */
  neutral50:   '#F4F0E6',
  neutral100:  'rgba(23,32,25,0.05)',
  neutral200:  'rgba(23,32,25,0.10)',
  neutral300:  'rgba(23,32,25,0.18)',
  neutral400:  'rgba(23,32,25,0.40)',
  neutral500:  '#59625B',
  neutral600:  '#4A524C',
  neutral700:  '#3E4740',
  neutral800:  '#2A322C',
  neutral900:  '#172019',

  /* liquid glass surfaces */
  glass:          'rgba(255,253,248,0.62)',
  glassSurface:   'rgba(255,253,248,0.82)',
  glassBorder:    'rgba(255,255,255,0.85)',
  glassHighlight: 'rgba(255,255,255,0.95)',
  shadow:         'rgba(23,32,25,0.14)',
  subtle:         'rgba(23,32,25,0.40)',

  /* card accents (darkened to read on cream) */
  plum:       '#7A3E8E',
  plumLight:  'rgba(122,62,142,0.12)',
  coral:      '#B9441B',
  coralLight: 'rgba(185,68,27,0.12)',
  teal:       '#1F5E8C',
  tealLight:  'rgba(31,94,140,0.12)',
  sand:       '#2F7D4F',
  sandLight:  'rgba(47,125,79,0.12)',

  /* status, all 4.5:1 or better on cream */
  success: '#2F6B3E',
  warning: '#8A4B00',
  danger:  '#B42318',
  info:    '#1F5E8C',
};

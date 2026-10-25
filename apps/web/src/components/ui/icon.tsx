import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'activity' | 'alert-triangle' | 'arrow-left' | 'arrow-right' | 'bell' | 'chart'
  | 'check' | 'check-circle' | 'chevron-left' | 'chevron-right' | 'circle-help'
  | 'clock' | 'cooking-pot' | 'headphones' | 'heart' | 'home' | 'image'
  | 'laptop' | 'log-out' | 'map-pin' | 'menu' | 'message-circle' | 'package'
  | 'plus' | 'receipt' | 'search' | 'settings' | 'shield-check' | 'shirt'
  | 'shopping-basket' | 'shoe' | 'smartphone' | 'sparkles' | 'store' | 'tag'
  | 'truck' | 'user' | 'user-check' | 'users' | 'wallet' | 'watch' | 'x'
  | 'shopping-cart' | 'gift';

const paths: Record<IconName, ReactNode> = {
  activity: <><path d="M3 12h4l2.5-7 5 14 2.5-7h4" /></>,
  'alert-triangle': <><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  'arrow-left': <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  'arrow-right': <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  chart: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7L16.5 9" /></>,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'circle-help': <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.6 2.6 0 1 1 4.6 1.7c-.9.8-2.2 1.2-2.2 2.8" /><path d="M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  'cooking-pot': <><path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" /><path d="M2 10h20" /><path d="M7 6c0-1 1-1 1-2" /><path d="M12 6c0-1 1-1 1-2" /><path d="M17 6c0-1 1-1 1-2" /></>,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 14h3v6H5a1 1 0 0 1-1-1Z" /><path d="M20 14h-3v6h2a1 1 0 0 0 1-1Z" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 15-5-5L5 20" /></>,
  laptop: <><rect x="4" y="4" width="16" height="12" rx="2" /><path d="M2 20h20" /></>,
  'log-out': <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></>,
  'map-pin': <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  'message-circle': <><path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.7-4.5A8.5 8.5 0 1 1 21 11.5Z" /></>,
  package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /><path d="m8 5.2 8 4.5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  'shield-check': <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m8.5 11.5 2.2 2.2 4.8-5" /></>,
  shirt: <><path d="m8 4 4 2 4-2 5 4-3 4v9H6v-9L3 8Z" /><path d="M12 6v4" /></>,
  'shopping-basket': <><path d="M4 10h16l-2 10H6Z" /><path d="m8 10 4-7 4 7" /><path d="M9 14v2" /><path d="M15 14v2" /></>,
  shoe: <><path d="M4 14c3 0 5-2 6-6 2 3 4 5 9 6 2 .5 2 4 0 5H6c-3 0-4-5-2-5Z" /></>,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 5h4" /><path d="M11 19h2" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z" /><path d="m5 13 .7 2.3L8 16l-2.3.7L5 19l-.7-2.3L2 16l2.3-.7Z" /></>,
  store: <><path d="M4 10v10h16V10" /><path d="M3 4h18l-2 6H5Z" /><path d="M8 20v-6h4v6" /><path d="M15 14h2" /></>,
  tag: <><path d="M20 13 13 20 4 11V4h7Z" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
  truck: <><path d="M3 5h11v12H3Z" /><path d="M14 9h4l3 4v4h-7Z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  'user-check': <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></>,
  wallet: <><path d="M3 6a2 2 0 0 1 2-2h14v16H5a2 2 0 0 1-2-2Z" /><path d="M3 8h16" /><path d="M15 12h6v4h-6a2 2 0 0 1 0-4Z" /></>,
  watch: <><rect x="7" y="6" width="10" height="12" rx="3" /><path d="m9 6 1-4h4l1 4" /><path d="m9 18 1 4h4l1-4" /><path d="M12 9v3l2 1" /></>,
  'shopping-cart': <><circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7" /></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M12 8v13" /><path d="M3 12h18" /><path d="M7.5 8C5 8 4 6.8 4 5.5S5 3 6.5 3C9 3 12 8 12 8" /><path d="M16.5 8C19 8 20 6.8 20 5.5S19 3 17.5 3C15 3 12 8 12 8" /></>,
  x: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
};

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  name: IconName;
  size?: number | string;
  label?: string;
};

export function Icon({ name, size = 20, label, ...props }: IconProps) {
  return <svg
    {...props}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    focusable="false"
  >{paths[name]}</svg>;
}

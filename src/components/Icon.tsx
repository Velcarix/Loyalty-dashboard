import type { ReactElement, SVGProps } from 'react'

export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'chart'
  | 'check'
  | 'chevron-down'
  | 'clipboard'
  | 'edit'
  | 'external'
  | 'gift'
  | 'image'
  | 'layout'
  | 'logout'
  | 'pause'
  | 'play'
  | 'plus'
  | 'program'
  | 'qrcode'
  | 'settings'
  | 'shield'
  | 'sparkles'
  | 'trash'
  | 'upload'
  | 'user'
  | 'x'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName
  size?: number
}

const paths: Record<IconName, ReactElement> = {
  'arrow-left': <path d="m15 18-6-6 6-6M9 12h12" />,
  'arrow-right': <path d="m9 18 6-6-6-6m6 6H3" />,
  chart: <path d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  clipboard: <path d="M9 5h6m-6 0a2 2 0 0 0-2 2v12h10V7a2 2 0 0 0-2-2m-6 0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />,
  edit: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />,
  external: <path d="M14 3h7v7m0-7L10 14M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />,
  gift: <path d="M20 12v8H4v-8m18-4H2v4h20ZM12 20V8m0 0H7.5A2.5 2.5 0 1 1 10 5.5C10 6.9 12 8 12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5C14 6.9 12 8 12 8Z" />,
  image: <path d="M4 5h16v14H4zM4 16l4-4 3 3 3-4 6 5M8 9h.01" />,
  layout: <path d="M4 5h16v14H4zM4 10h16M9 10v9" />,
  logout: <path d="M10 17l5-5-5-5m5 5H3m10-7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1" />,
  pause: <path d="M9 5v14m6-14v14" />,
  play: <path d="m9 5 10 7-10 7Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  program: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v13.5A2.5 2.5 0 0 0 17.5 15H4Zm0 0V20h13.5" />,
  qrcode: <path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0v2m0 4v-2m3-4h3m-3 3h3m-3 3h3m-6-3h2" />,
  settings: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-11.5v2m0 12v2m8-8h-2M6 12H4m13.66-5.66-1.42 1.42M7.76 16.24l-1.42 1.42m0-11.32 1.42 1.42m8.48 8.48 1.42 1.42" />,
  shield: <path d="M12 3 5 6v5c0 4.55 2.98 8.74 7 10 4.02-1.26 7-5.45 7-10V6Zm-3 9 2 2 4-4" />,
  sparkles: <path d="m12 3-1.2 4.3L7 8.5l3.8 1.2L12 14l1.2-4.3L17 8.5l-3.8-1.2Zm6 10-.7 2.3L15 16l2.3.7ZM6 14l-.6 2-1.9.6 2-.6Z" />,
  trash: <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />,
  upload: <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />,
  user: <path d="M20 21a8 8 0 0 0-16 0m12-12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

export function Icon({ name, size = 18, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

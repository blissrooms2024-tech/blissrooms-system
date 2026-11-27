/**
 * Line icons for the app shell and home page — one consistent outline style (24px grid,
 * 1.8 stroke, round joins) so the bottom tabs, module row and quick actions read as one set.
 */
import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9v10.5h13V9" />
    <path d="M10 19.5v-5h4v5" />
  </Svg>
);
export const IconContract = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h8.5L19 8v12.5H6z" />
    <path d="M14 3.5V8h5" />
    <path d="M9 12h7M9 15.5h7M9 8.5h2.5" />
  </Svg>
);
export const IconBed = (p: P) => (
  <Svg {...p}>
    <path d="M3 18.5V6" />
    <path d="M3 13h18v5.5" />
    <path d="M3 16h18" />
    <path d="M6.5 13v-2.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V13" />
    <path d="M12.5 13v-1.5a1.5 1.5 0 0 1 1.5-1.5h4a3 3 0 0 1 3 3" />
  </Svg>
);
export const IconWallet = (p: P) => (
  <Svg {...p}>
    <path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <path d="M4 7.5 15.5 4v3.5" />
    <path d="M16 14h4" />
  </Svg>
);
export const IconGrid = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);
export const IconBuilding = (p: P) => (
  <Svg {...p}>
    <path d="M5 20.5V5.5l7-2v17" />
    <path d="M12 8.5l7 2.5v9.5" />
    <path d="M3.5 20.5h17" />
    <path d="M8 8.5h1M8 11.5h1M8 14.5h1M15 13.5h1M15 16.5h1" />
  </Svg>
);
export const IconWrench = (p: P) => (
  <Svg {...p}>
    <path d="M15.1 5.9 17.2 3.8A5 5 0 0 0 11 10.7L4.5 17.3a1.6 1.6 0 0 0 2.2 2.2L13.3 13A5 5 0 0 0 20.2 6.8L18.1 8.9Z" />
  </Svg>
);
export const IconReceiptCheck = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
    <path d="M9 11.5l2.2 2.2L15.5 9" />
  </Svg>
);
export const IconCalculator = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <path d="M8 7.5h8" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01" strokeWidth={2.6} />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);
export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h16" />
    <path d="M7 16.5v-5M11 16.5v-9M15 16.5v-6.5M19 16.5V5" />
  </Svg>
);
export const IconReceipt = (p: P) => (
  <Svg {...p}>
    <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
    <path d="M9 8h6M9 11.5h6M9 15h3.5" />
  </Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 19.5a6 6 0 0 1 12 0" />
    <path d="M15.5 5.5a3.5 3.5 0 0 1 0 6.5M17.5 14a6 6 0 0 1 3.5 5.5" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconTicket = (p: P) => (
  <Svg {...p}>
    <path d="M4 7.5h16v3a1.5 1.5 0 0 0 0 3v3H4v-3a1.5 1.5 0 0 0 0-3z" />
    <path d="M14 7.5v9" strokeDasharray="1.5 2" />
  </Svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12A7.5 7.5 0 0 1 6 16.5" />
    <path d="M4.5 12A7.5 7.5 0 0 1 18 7.5" />
    <path d="M18.5 3.5v4h-4M5.5 20.5v-4h4" />
  </Svg>
);
export const IconMegaphone = (p: P) => (
  <Svg {...p}>
    <path d="M4 10v4h3l7 4.5v-13L7 10z" />
    <path d="M17.5 9a4 4 0 0 1 0 6" />
    <path d="M7 14l1 5.5h2.5L10 15.5" />
  </Svg>
);
export const IconCash = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="6.5" width="18" height="11" rx="1.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 9.5v.01M17.5 14.5v.01" strokeWidth={2.4} />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M12 14.5v2.5" />
  </Svg>
);
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" />
  </Svg>
);
export const IconBank = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 9 12 4l8.5 5z" />
    <path d="M5.5 9.5v7.5M10 9.5v7.5M14 9.5v7.5M18.5 9.5v7.5" />
    <path d="M3.5 20h17" />
  </Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M14 4.5H6.5v15H14" />
    <path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);
export const IconDoorIn = (p: P) => (
  <Svg {...p}>
    <path d="M13 3.5h5.5v17H13" />
    <path d="M3.5 12h10M10 8.5l3.5 3.5-3.5 3.5" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="15" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
);
export const IconSliders = (p: P) => (
  <Svg {...p}>
    <path d="M5 7h9M18 7h1M5 17h3M12 17h7" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);
export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4 21 19.5H3z" />
    <path d="M12 10v4.5M12 17v.01" />
  </Svg>
);
export const IconSignature = (p: P) => (
  <Svg {...p}>
    <path d="M4 17.5c2-4 3.5-9 5.5-9 2.5 0-1.5 9 1 9 1.5 0 2-3 3.5-3 1 0 1 2 2 2s1.5-1 2.5-1.5" />
    <path d="M4 20.5h16" />
  </Svg>
);
export const IconFolder = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5h7.5A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z" />
  </Svg>
);
export const IconBolt = (p: P) => (
  <Svg {...p}>
    <path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12z" />
  </Svg>
);
export const IconTrend = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 17 9 11.5l3.5 3.5 8-8" />
    <path d="M15 7h5.5v5.5" />
  </Svg>
);
export const IconPie = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" />
    <path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15z" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5 10 17.5 19 7" />
  </Svg>
);
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6M6.4 7.4A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.3-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Svg>
);
export const IconMail = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </Svg>
);
export const IconArrowUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 19.5l1.2-3.6A7.5 7.5 0 1 1 8.6 18.6z" />
  </Svg>
);
export const IconCar = (p: P) => (
  <Svg {...p}>
    <path d="M5 16.5V12l2-5h10l2 5v4.5" />
    <path d="M3.5 16.5h17v2.5h-3v-2.5M6.5 16.5V19h-3" />
    <path d="M5 12h14" />
    <path d="M7.5 14.3h.01M16.5 14.3h.01" strokeWidth={2.6} />
  </Svg>
);
export const IconHourglass = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 3.5h11M6.5 20.5h11" />
    <path d="M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2" />
    <path d="M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-13" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Svg>
);
export const IconPen = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 4.5l4 4L9 19l-5 1 1-5z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);
export const IconIdCard = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 15.5a3 3 0 0 1 6 0M14 10h4M14 13.5h3" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </Svg>
);
export const IconDots = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3} />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
    <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Svg>
);

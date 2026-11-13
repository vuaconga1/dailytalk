import Image from "next/image";
import Link from "next/link";

type IconProps = { className?: string };

const stroke = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function MailIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function MapPinIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps) {
  return (
    <svg {...stroke} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className ?? ""}`} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.85 4.85 0 0 1-1-.15Z" />
    </svg>
  );
}

function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className ?? ""}`} aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8ZM9.75 15.5v-7l6.5 3.5-6.5 3.5Z" />
    </svg>
  );
}

const EMAIL = "officemanager@wewin.edu.vn";

const socials = [
  { label: "Zalo", href: "#", bg: "bg-[#0068FF]", icon: <span className="text-sm font-bold">Z</span> },
  {
    label: "Facebook",
    href: "https://www.facebook.com/winwineducation",
    bg: "bg-[#1877F2]",
    icon: <span className="text-sm font-bold">f</span>,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@wewin.education.vn",
    bg: "bg-zinc-950",
    icon: <TikTokIcon className="h-4 w-4" />,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@WeWINEducation",
    bg: "bg-[#FF0000]",
    icon: <YouTubeIcon className="h-4 w-4" />,
  },
  { label: "Email", href: `mailto:${EMAIL}`, bg: "bg-blue-accent", icon: <MailIcon className="h-4 w-4" /> },
];

const mapUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const contacts = [
  {
    label: "Cơ sở 1",
    value: "292B Nơ Trang Long, P.12, Bình Thạnh, TP.HCM",
    href: mapUrl("292B Nơ Trang Long, P.12, Bình Thạnh, TP.HCM"),
    Icon: MapPinIcon,
    external: true,
  },
  { label: "Hotline cơ sở 1", value: "0345 969 388", href: "tel:+84345969388", Icon: PhoneIcon },
  {
    label: "Cơ sở 2",
    value: "742 Xô Viết Nghệ Tĩnh, phường Thạnh Mỹ Tây, Bình Thạnh, TP.HCM",
    href: mapUrl("742 Xô Viết Nghệ Tĩnh, phường Thạnh Mỹ Tây, Bình Thạnh, TP.HCM"),
    Icon: MapPinIcon,
    external: true,
  },
  { label: "Hotline cơ sở 2", value: "037 866 9388", href: "tel:+84378669388", Icon: PhoneIcon },
  { label: "Email", value: EMAIL, href: `mailto:${EMAIL}`, Icon: MailIcon },
  { label: "Website", value: "wewin.edu.vn", href: "https://wewin.edu.vn", Icon: GlobeIcon, external: true },
];

const externalProps = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SiteFooter({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <footer id="site-footer" className="w-full border-t border-white/10 bg-navy text-white">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:py-6 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-start lg:gap-8">
          <div className="min-w-0">
            <Link href={homeHref} className="inline-flex items-center gap-2.5">
              <Image src="/brand/wewin-mark.png" alt="WEWIN" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="text-base font-bold tracking-wide">
                <span className="text-gold">WEWIN</span> <span className="text-white">Education</span>
              </span>
            </Link>
            <p className="mt-1.5 max-w-md text-xs leading-snug text-white/85">WEWIN BỨT PHÁ TIẾNG ANH – VƯƠN TẦM THẾ GIỚI</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  {...(s.href.startsWith("http") ? externalProps : {})}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none ${s.bg}`}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Thông tin liên hệ</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {contacts.map(({ label, value, href, Icon, external }) => (
                <li key={label} className="min-w-0">
                  <a
                    href={href}
                    {...(external ? externalProps : {})}
                    className="flex h-full w-full gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 transition hover:bg-white/10"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-amber-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] leading-tight font-medium text-white/65">{label}</span>
                      <span className="mt-0.5 block text-xs leading-snug font-medium break-words text-white">{value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 w-full text-center text-[11px] text-white/60">
          © {new Date().getFullYear()} WeWIN Education. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

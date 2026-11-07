import type { Metadata } from "next";
import NextLink from "next/link";
import { Geist, Geist_Mono, Noto_Sans_SC, El_Messiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { getLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { getLocaleDirection } from "@/i18n/direction";
import { SITE_NAME, SITE_DESCRIPTION } from "@/config/site";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Arabic pairing: El Messiri for headings (Naskh-derived warmth,
// mirrors Fraunces's display role), IBM Plex Sans Arabic for body/UI (the
// Geist analogue). subsets: ['arabic'] means the generated @font-face only
// covers Arabic codepoints. Latin text (brand name, URLs) has no matching
// glyphs in these files, so it falls through to Geist in the CSS stack
// automatically, and browsers never fetch these fonts on non-Arabic pages
// since no rendered text matches their unicode-range.
const elMessiri = El_Messiri({
  variable: "--font-el-messiri",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic"],
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  // Absolute base for the icon and Open Graph image URLs in link previews.
  metadataBase: new URL(siteUrl()),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const buildId = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'
  const locale = await getLocale()
  const dir = getLocaleDirection(locale)
  // Root layout sits above [locale]/layout.tsx's NextIntlClientProvider, so the
  // i18n <Link> (which needs that context) can't be used here; resolve the
  // locale-aware href as a plain string instead.
  const privacyHref = getPathname({ href: '/privacy', locale })
  const termsHref = getPathname({ href: '/terms', locale })

  return (
    <html lang={locale} dir={dir}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} ${elMessiri.variable} ${ibmPlexSansArabic.variable} antialiased`}>
        {children}
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
        <div className="bg-gray-950 text-gray-500 text-xs px-4 py-2 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <NextLink href={privacyHref} className="hover:text-gray-300 transition-colors">Privacy</NextLink>
            <NextLink href={termsHref} className="hover:text-gray-300 transition-colors">Terms</NextLink>
            <span className="font-mono">Release Commit [{buildId}]</span>
          </div>
        </div>
      </body>
    </html>
  );
}

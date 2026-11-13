import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const appSans = Be_Vietnam_Pro({
  variable: "--font-app-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WeWIN Daily Speaking",
  description: "WeWIN Daily Speaking — 15 phút tiếng Anh mỗi ngày cho người đi làm.",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "500x500", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1e33",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${appSans.variable} antialiased`}>{children}</body>
    </html>
  );
}

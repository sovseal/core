import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Inter, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import { AISearch, AISearchPanel, AISearchTrigger } from "@/components/search";
import { MessageCircleIcon } from "lucide-react";

export const metadata: Metadata = {
  title: {
    template: "%s | sovseal docs",
    default: "sovseal documentation",
  },
  description:
    "Local-first, zero-knowledge memory layer for AI agents. 0-RTT recall, AES-256-GCM ciphertext replication, cryptographically verified state.",
  metadataBase: new URL("https://docs.sovseal.com"),
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-default.png"],
  },
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfairDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <AISearch>
            {children}
            <AISearchPanel />
          </AISearch>
        </RootProvider>
      </body>
    </html>
  );
}

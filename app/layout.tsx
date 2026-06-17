import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";
import InstallPWA from "./components/InstallPWA";
import TenantGuard from "./components/TenantGuard";
import { AuthProvider } from "./components/AuthProvider";
import AppBootstrap from "./components/AppBootstrap";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hosteleaze - Premium Hostel Management System",
  description: "Hosteleaze is a modern, enterprise-grade multi-tenant hostel management platform for colleges and universities to manage check-ins, gatepasses, students, and attendance.",
  metadataBase: new URL("https://www.hosteleaze.com"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://www.hosteleaze.com",
    siteName: "Hosteleaze",
    title: "Hosteleaze - Premium Hostel Management System",
    description: "Hosteleaze is an enterprise-grade platform for universities to manage hostels, permissions, and gatepasses in real-time.",
    images: [
      {
        url: "/logo.jpeg",
        width: 800,
        height: 600,
        alt: "Hosteleaze Logo",
      }
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hosteleaze",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5, // Allows zooming up to 5x
    userScalable: true, // Enables user zooming
    themeColor: "#2563eb",
    viewportFit: "cover", // Ensures content fills the screen including the notch area
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${lora.variable} antialiased`} suppressHydrationWarning>
        <InstallPWA />
        <AppBootstrap />
        <AuthProvider>
          <TenantGuard>
            {children}
          </TenantGuard>
        </AuthProvider>
      </body>
    </html>
  );
}

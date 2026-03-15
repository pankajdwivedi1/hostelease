import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";
import InstallPWA from "./components/InstallPWA";
import TenantGuard from "./components/TenantGuard";
import { AuthProvider } from "./components/AuthProvider";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Hostelease - Hostel Management",
  description: "Hostel Management System Reimagined - Manage permissions, students, and hostel operations seamlessly",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hostelease",
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
        <AuthProvider>
          <TenantGuard>
            {children}
          </TenantGuard>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Scan GATEPASS QR | HostelEase",
    description: "Scan the QR code at the campus gate to check in or out",
};

export default function ScanLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.2); }
          50% { box-shadow: 0 0 40px rgba(0, 255, 136, 0.4); }
        }
      `}</style>
            {children}
        </>
    );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GATEPASS - Campus Gate Monitor | HostelEase",
  description: "Campus outing management system - QR-based student tracking at the gate",
};

export default function GetPassLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes qrPulse {
          0% { transform: scale(1); box-shadow: 0 0 60px rgba(0, 255, 136, 0.2); }
          50% { transform: scale(1.02); box-shadow: 0 0 120px rgba(0, 255, 136, 0.4); }
          100% { transform: scale(1); box-shadow: 0 0 60px rgba(0, 255, 136, 0.2); }
        }
        
        /* Custom scrollbar for gate desktop */
        .getpass-container ::-webkit-scrollbar {
          width: 6px;
        }
        .getpass-container ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 3px;
        }
        .getpass-container ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }
        .getpass-container ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }

        /* Hide cursor after inactivity (for kiosk mode) */
        body {
          cursor: default;
        }
      `}</style>
      <div className="getpass-container">
        {children}
      </div>
    </>
  );
}

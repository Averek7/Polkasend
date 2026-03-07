import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "PolkaSend — Cross-Border Remittance on Polkadot",
  description:
    "Send money to India for under 0.5% using the Polkadot ecosystem. Near-instant UPI settlement. Built on Substrate FRAME with XCM.",
  keywords: ["polkadot", "remittance", "india", "UPI", "substrate", "XCM", "blockchain"],
  openGraph: {
    title: "PolkaSend",
    description: "Cross-border remittance on Polkadot",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="grid-bg min-h-screen">
        {/* Ambient glow top-right */}
        <div
          className="pointer-events-none fixed right-0 top-0 z-0 h-[600px] w-[600px] -translate-y-1/4 translate-x-1/4 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(230,0,122,0.10) 0%, transparent 70%)",
          }}
        />
        {/* Ambient glow bottom-left */}
        <div
          className="pointer-events-none fixed bottom-0 left-0 z-0 h-[400px] w-[400px] translate-y-1/4 -translate-x-1/4 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(108,159,255,0.06) 0%, transparent 70%)",
          }}
        />
        <Providers>
          {children}
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "#16161e",
                border: "1px solid rgba(230,0,122,0.2)",
                color: "#f0f0f8",
                fontFamily: "var(--font-body)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}

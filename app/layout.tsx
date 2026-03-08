import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "PolkaSend — Polkadot Cross-Border Remittance",
  description:
    "Send money to India for under 0.5%. Built on Polkadot parachains with XCM, custom FRAME pallets, and UPI settlement.",
  keywords: [
    "polkadot",
    "remittance",
    "india",
    "blockchain",
    "xcm",
    "substrate",
    "defi",
  ],
  openGraph: {
    title: "PolkaSend",
    description: "Near-instant cross-border remittance to India via Polkadot",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

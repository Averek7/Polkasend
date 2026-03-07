import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { PolkaSendLogoHero } from "@/components/logo/PolkaSendLogo";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { ArrowRight, Zap, Shield, Globe } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-16 text-center">
        {/* Animated logo hero */}
        <div className="mb-10 flex justify-center">
          <PolkaSendLogoHero size={110} />
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(230,0,122,0.18)] bg-[rgba(230,0,122,0.05)] px-4 py-1.5 text-xs font-mono text-[#E6007A]">
          <span className="animate-pulse">●</span>
          POLKADOT PARACHAIN · SUBSTRATE FRAME · XCM v4
        </div>

        {/* Headline */}
        <h1
          className="mb-5 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Send money to India
          <br />
          for{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #E6007A, #ff6eb5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            under 0.5%
          </span>
        </h1>

        <p className="mb-10 max-w-xl text-lg leading-relaxed text-[#7070a0]">
          A purpose-built Polkadot parachain for cross-border remittance. Near-instant
          UPI settlement. Fully KYC/AML compliant. Built with Substrate FRAME pallets.
        </p>

        {/* CTA buttons */}
        <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
          <Link href="/send">
            <button
              className="group flex items-center gap-2 rounded-2xl bg-[#E6007A] px-8 py-4 text-base font-bold text-white shadow-[0_8px_32px_rgba(230,0,122,0.3)] transition hover:bg-[#cc006b] hover:shadow-[0_8px_40px_rgba(230,0,122,0.45)]"
            >
              Start Sending
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          </Link>
          <Link href="/kyc">
            <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-semibold text-[#f0f0f8] backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]">
              <Shield size={18} />
              Complete KYC
            </button>
          </Link>
        </div>

        {/* Stats */}
        <HeroStats />

        {/* Feature pills */}
        <div className="mt-16 flex flex-wrap justify-center gap-3">
          {[
            { icon: Zap, label: "~36s settlement via UPI" },
            { icon: Shield, label: "RBI FEMA Compliant" },
            { icon: Globe, label: "USA · UAE · UK Corridors" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#16161e]/80 px-5 py-3 text-sm text-[#7070a0] backdrop-blur"
            >
              <Icon size={15} className="text-[#E6007A]" />
              {label}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

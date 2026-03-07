import { Navbar } from "@/components/layout/Navbar";
import { SendPanel } from "@/components/send/SendPanel";

export default function SendPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1
            className="text-3xl font-extrabold tracking-tight text-[#f0f0f8]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Send Remittance
          </h1>
          <p className="mt-1 text-sm text-[#7070a0]">
            Transfer funds to India via the PolkaSend parachain · Para #3000
          </p>
        </div>
        <SendPanel />
      </main>
    </div>
  );
}

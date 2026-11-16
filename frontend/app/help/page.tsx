import Link from "next/link";
import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react";

const setup = [
  "Copy frontend/.env.example to frontend/.env.local.",
  "Set provider endpoint URLs and model IDs on the server. Add API keys only to the server environment.",
  "Restart the Next.js server and open API Integrations to review status and test text providers.",
  "Use Speech Studio to record/upload audio, or Live Translate to run the batch transcription-to-translation workflow.",
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><BookOpen aria-hidden="true" className="size-3.5" />HELP CENTER</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Get started with LINGUA AI</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">A guide to the existing KasaSpeech workflow and the optional language providers in this workspace.</p>
      </section>
      <section className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Configure a provider</h2>
        <ol className="mt-4 space-y-3">{setup.map((step, index) => <li key={step} className="flex items-start gap-3 text-[11px] leading-5 text-slate-300"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-400/10 text-[10px] font-semibold text-cyan-200">{index + 1}</span>{step}</li>)}</ol>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-[#071631] p-3.5"><p className="text-[11px] font-semibold text-slate-200">Text provider formats</p><p className="mt-1.5 text-[10px] leading-5 text-slate-500">The default adapter sends OpenAI-compatible chat-completions requests. Set a task&apos;s FORMAT=rest to send the documented generic JSON payload instead.</p></div>
          <div className="rounded-xl border border-white/[0.06] bg-[#071631] p-3.5"><p className="text-[11px] font-semibold text-slate-200">Language detection</p><p className="mt-1.5 text-[10px] leading-5 text-slate-500">The configured detector receives multipart audio. It must return a language value and may return confidence between 0 and 1. Low or missing confidence requires confirmation.</p></div>
        </div>
      </section>
      <section className="flex items-start gap-3 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.035] p-4 text-[11px] leading-5 text-cyan-100/75">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" />
        <p>Provider secrets are read only by Next.js route handlers. This starter has no user accounts or tenant-isolated API management. Do not expose it publicly with private provider credentials until authentication, authorization, persistent secure secret storage and request quotas are added.</p>
      </section>
      <div className="flex flex-wrap gap-4 text-[11px]">
        <Link href="/integrations" className="font-semibold text-cyan-300 hover:text-white">API integrations →</Link>
        <Link href="/studio" className="font-semibold text-cyan-300 hover:text-white">Speech Studio →</Link>
        <Link href="/live-translate" className="font-semibold text-cyan-300 hover:text-white">Live Translate →</Link>
        <a href="https://github.com/Johannessiaw/Kasaspeech" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-slate-400 hover:text-white">Project repository <ExternalLink aria-hidden="true" className="size-3" /></a>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  AudioLines,
  Bot,
  CheckCircle2,
  Languages,
  Mic,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react";
import { useEffect, useState } from "react";

type ProviderStatus = {
  translation: boolean;
  assistant: boolean;
  tts: boolean;
  detection: boolean;
};

const modules = [
  {
    name: "Speech to text",
    short: "ASR",
    description: "Turn recordings into accurate text with KasaSpeech.",
    href: "/studio",
    icon: Mic,
    gradient: "from-blue-600 to-cyan-400",
    glow: "bg-sky-400/20",
    statusKey: "asr" as const,
  },
  {
    name: "Text to speech",
    short: "TTS",
    description: "Generate natural speech with your connected voice model.",
    href: "/tts",
    icon: Volume2,
    gradient: "from-violet-600 to-fuchsia-400",
    glow: "bg-violet-400/20",
    statusKey: "tts" as const,
  },
  {
    name: "Language translation",
    short: "TRANSLATOR",
    description: "Translate text between the languages your provider supports.",
    href: "/translate",
    icon: Languages,
    gradient: "from-cyan-600 to-teal-400",
    glow: "bg-teal-400/20",
    statusKey: "translation" as const,
  },
];

export function DashboardOverview() {
  const [providers, setProviders] = useState<ProviderStatus>({
    translation: false,
    assistant: false,
    tts: false,
    detection: false,
  });

  useEffect(() => {
    let active = true;
    void fetch("/api/language", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const status: unknown = await response.json();
        if (typeof status !== "object" || status === null || !("providers" in status)) return;
        const items = status.providers as Record<string, { configured?: boolean }>;
        if (active) {
          setProviders({
            translation: items.translation?.configured === true,
            assistant: items.assistant?.configured === true,
            tts: items.tts?.configured === true,
            detection: "detectionConfigured" in status &&
              (status as { detectionConfigured?: boolean }).detectionConfigured === true,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <section className="relative isolate overflow-hidden rounded-[26px] border border-blue-300/[0.12] bg-[linear-gradient(112deg,#0d2860_0%,#102556_43%,#0b3451_100%)] px-6 py-7 shadow-[0_26px_75px_-48px_rgba(27,119,255,.7)] sm:px-9 sm:py-9 lg:px-11 lg:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-28 -z-10 size-80 rounded-full border border-cyan-100/[0.08]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-1 -top-20 -z-10 size-64 rounded-full border border-cyan-100/[0.08]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-48 -z-10 size-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/[0.08] px-3 py-1.5 text-[11px] font-medium text-cyan-100">
            <Sparkles aria-hidden="true" className="size-3.5" />
            One workspace. Many voices.
          </div>
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-[42px]">
            Break language barriers with AI.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100/75 sm:text-[15px] sm:leading-7">
            Record, transcribe and translate with a growing toolkit built for
            Ghanaian languages and conversations around the world.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/live-translate" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#102556] shadow-lg transition hover:bg-cyan-50">
              <Waves aria-hidden="true" className="size-4" />
              Start live translate
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/integrations" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.1]">
              Connect a provider
            </Link>
          </div>
        </div>
        <div className="absolute bottom-8 right-10 hidden items-end gap-1 opacity-40 xl:flex" aria-hidden="true">
          {[20, 34, 24, 48, 30, 58, 34, 46, 22, 38, 56, 27, 44, 30, 52, 23].map((height, index) => (
            <span key={index} className="w-1.5 rounded-full bg-cyan-200" style={{ height }} />
          ))}
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="modules-heading" className="text-lg font-semibold tracking-tight text-white">Your language workspace</h2>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">Choose a tool to start working with speech and language.</p>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            KasaSpeech ASR available
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {modules.map(({ name, short, description, href, icon: Icon, gradient, glow, statusKey }) => {
            const connected = statusKey === "asr" || providers[statusKey];
            return (
              <article key={short} className="group overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] shadow-[0_15px_45px_-35px_rgba(0,0,0,.8)] transition hover:-translate-y-0.5 hover:border-white/[0.15]">
                <div className={`relative flex min-h-32 items-center justify-between overflow-hidden bg-gradient-to-br ${gradient} px-5 py-5`}>
                  <div aria-hidden="true" className={`absolute -right-8 -top-10 size-36 rounded-full ${glow} blur-2xl`} />
                  <div className="relative">
                    <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/[0.09] px-2.5 py-1 text-[9px] font-bold tracking-[0.13em] text-white/90">
                      {short}
                    </span>
                    <h3 className="text-lg font-semibold text-white">{name}</h3>
                  </div>
                  <div className="relative flex size-[58px] shrink-0 items-center justify-center rounded-[18px] border border-white/25 bg-white/15 text-white shadow-inner">
                    <Icon aria-hidden="true" className="size-7" />
                  </div>
                </div>
                <div className="bg-[#f3f7ff] px-5 py-5 text-[#17264a]">
                  <p className="min-h-10 text-[12px] leading-5 text-[#596887]">{description}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${connected ? "text-emerald-700" : "text-amber-700"}`}>
                      <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {connected ? (statusKey === "asr" ? "KasaSpeech ready" : "Provider configured") : "Provider not configured"}
                    </span>
                    <Link href={href} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0b64ec] px-3 text-xs font-semibold text-white transition hover:bg-[#0754cd]">
                      Open workspace
                      <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Language pipeline</h2>
              <p className="mt-1 text-xs text-slate-400">Speech to understanding, with clear provider status at every step.</p>
            </div>
            <Link href="/live-translate" className="text-xs font-medium text-cyan-300 hover:text-cyan-100">Open pipeline <ArrowRight aria-hidden="true" className="ml-1 inline size-3.5" /></Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { label: "Capture speech", icon: Mic, ok: true },
              { label: "Detect language", icon: Languages, ok: providers.detection },
              { label: "Transcribe audio", icon: AudioLines, ok: true },
              { label: "Translate text", icon: ArrowDownLeft, ok: providers.translation },
            ].map(({ label, icon: Icon, ok }, index) => (
              <div key={label} className="relative flex min-h-[84px] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ok ? "bg-cyan-300/10 text-cyan-200" : "bg-white/[0.05] text-slate-500"}`}><Icon aria-hidden="true" className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-200">{label}</span>
                  <span className={`mt-1 block text-[9px] ${ok ? "text-emerald-300" : "text-slate-500"}`}>{ok ? "Configured" : "Setup required"}</span>
                </span>
                {index < 3 && <ArrowRight aria-hidden="true" className="absolute -right-2.5 z-10 hidden size-4 text-slate-600 sm:block" />}
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-cyan-400/70" />
            The current KasaSpeech endpoint returns transcripts only. Language detection and translation appear only when their providers are configured.
          </p>
        </div>

        <div className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,#10264f,#0a1c3d)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><Bot aria-hidden="true" className="size-5" /></span>
            <div>
              <h2 className="text-sm font-semibold text-white">Language assistant</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Grammar, summaries and language questions, powered by your own compatible model.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/[0.12] px-3.5 py-3">
            <span className="text-[11px] text-slate-300">{providers.assistant ? "Provider connected" : "No assistant provider yet"}</span>
            <Link href="/assistant" className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-white">Open assistant <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}

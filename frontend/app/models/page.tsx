"use client";

import Link from "next/link";
import { Activity, AudioLines, Bot, Languages, Mic, Settings2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

type ProviderStatus = { configured: boolean; model: string | null };
type StatusResponse = { providers: Record<string, ProviderStatus>; detectionConfigured?: boolean };

const definitions = [
  { task: "Speech recognition", key: "asr", icon: Mic, detail: "Existing KasaSpeech Gradio Space. Supports its trained Ghanaian English–Twi speech task; language detection is not returned by the current endpoint." },
  { task: "Language detection", key: "detection", icon: Languages, detail: "Optional audio-language identification endpoint. Must return a language code and may return an actual confidence score." },
  { task: "Translation", key: "translation", icon: Languages, detail: "OpenAI-compatible chat or custom JSON REST provider; actual language-pair coverage is provider-defined." },
  { task: "Text to speech", key: "tts", icon: Volume2, detail: "Audio-generation endpoint. Voice and language availability depend on the connected provider." },
  { task: "AI assistant", key: "assistant", icon: Bot, detail: "OpenAI-compatible chat or custom JSON REST language assistant." },
];

export default function ModelManagerPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/language", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load configured model status.");
        const data = (await response.json()) as StatusResponse;
        if (active) setStatus(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load model status.");
      });
    return () => {
      active = false;
    };
  }, []);

  const configured = (key: string) => {
    if (key === "asr") return true;
    if (key === "detection") return status?.detectionConfigured === true;
    return status?.providers[key]?.configured === true;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><AudioLines aria-hidden="true" className="size-3.5" />MODEL MANAGER</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Models & capabilities</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">A live view of model endpoints currently configured on this server. Provider language coverage is not assumed; check each provider&apos;s documentation.</p>
      </section>
      {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-3 text-xs text-rose-100">{error}</p>}
      <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0a1c3d]">
        <div className="hidden grid-cols-[1.1fr_1.2fr_1fr_1fr] gap-4 border-b border-white/[0.07] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500 sm:grid">
          <span>Task</span><span>Configured model</span><span>Endpoint status</span><span>Language support</span>
        </div>
        {definitions.map(({ task, key, icon: Icon, detail }) => {
          const ready = configured(key);
          const model = key === "asr"
            ? "KasaSpeech · Gradio Space"
            : key === "detection"
              ? "Server-configured detector"
              : status?.providers[key]?.model ?? "";
          return (
            <article key={key} className="grid gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0 sm:grid-cols-[1.1fr_1.2fr_1fr_1fr] sm:items-center sm:gap-4">
              <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-400/10 text-cyan-200"><Icon aria-hidden="true" className="size-4" /></span><span className="text-xs font-medium text-slate-200">{task}</span></div>
              <div className="text-[11px] text-slate-400">{status ? model || <span className="text-slate-600">No model configured</span> : "Loading…"}</div>
              <span className={`inline-flex w-fit items-center gap-1.5 text-[10px] ${ready ? "text-emerald-300" : "text-amber-200"}`}><span className={`size-1.5 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} />{ready ? (key === "asr" ? "Configured · checked on use" : "Configured · untested") : "Not configured"}</span>
              <p className="text-[10px] leading-5 text-slate-500">{detail}</p>
            </article>
          );
        })}
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.035] p-4 text-[11px] leading-5 text-cyan-100/75">
        <Activity aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" />
        <p>This deployment currently supports one environment-configured provider per language task. Multiple per-user models, priority routing and editable model records require an authenticated configuration store that is not present in the existing repository. Provider setup is managed server-side.</p>
      </div>
      <Link href="/integrations" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-white"><Settings2 aria-hidden="true" className="size-4" />Manage API integrations</Link>
    </div>
  );
}

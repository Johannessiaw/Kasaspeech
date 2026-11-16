"use client";

import Link from "next/link";
import {
  Activity,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Languages,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

type Provider = "translation" | "assistant" | "tts";
type Status = { configured: boolean; model: string | null; hasApiKey: boolean };
type TestResult = { state: "idle" | "testing" | "connected" | "error"; message: string; responseMs?: number };

const providerCards: {
  id: Provider | "asr" | "detection";
  title: string;
  description: string;
  icon: typeof Mic;
  envNames: string[];
  testable: boolean;
}[] = [
  { id: "asr", title: "Speech recognition (ASR)", description: "Existing KasaSpeech Gradio Space. Audio is submitted only when the user requests transcription.", icon: Mic, envNames: ["JOHANNES02/kasaspeech · /transcribe"], testable: false },
  { id: "detection", title: "Language detection", description: "Optional multipart audio endpoint returning a language code and optional confidence.", icon: Languages, envNames: ["LINGUA_DETECTION_API_URL", "LINGUA_DETECTION_API_KEY"], testable: false },
  { id: "translation", title: "Machine translation", description: "OpenAI-compatible chat completions or a configured JSON REST endpoint.", icon: Languages, envNames: ["LINGUA_TRANSLATION_API_URL", "LINGUA_TRANSLATION_API_KEY", "LINGUA_TRANSLATION_MODEL"], testable: true },
  { id: "tts", title: "Text to speech", description: "OpenAI-compatible audio speech endpoint or configured JSON REST audio endpoint.", icon: Volume2, envNames: ["LINGUA_TTS_API_URL", "LINGUA_TTS_API_KEY", "LINGUA_TTS_MODEL"], testable: true },
  { id: "assistant", title: "AI assistant", description: "OpenAI-compatible chat completions or a configured JSON REST endpoint.", icon: Bot, envNames: ["LINGUA_ASSISTANT_API_URL", "LINGUA_ASSISTANT_API_KEY", "LINGUA_ASSISTANT_MODEL"], testable: true },
];

export function ProviderConsole() {
  const [providers, setProviders] = useState<Record<string, Status>>({});
  const [detectionConfigured, setDetectionConfigured] = useState(false);
  const [detectionHasApiKey, setDetectionHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  const refresh = async () => {
    setError("");
    try {
      const response = await fetch("/api/language", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read the server-side provider status.");
      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null || !("providers" in data)) {
        throw new Error("The provider status response was invalid.");
      }
      const result = data as { providers: Record<string, Status>; detectionConfigured?: boolean; detectionHasApiKey?: boolean };
      setProviders(result.providers);
      setDetectionConfigured(result.detectionConfigured === true);
      setDetectionHasApiKey(result.detectionHasApiKey === true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read provider status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const test = async (provider: Provider) => {
    setTests((current) => ({ ...current, [provider]: { state: "testing", message: "Sending a real test request…" } }));
    try {
      const response = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "test", provider }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : `Test failed (${response.status}).`);
      }
      if (typeof data !== "object" || data === null || !("responseMs" in data) || typeof data.responseMs !== "number") {
        throw new Error("The provider test returned an invalid response.");
      }
      setTests((current) => ({ ...current, [provider]: { state: "connected", message: "Test request succeeded.", responseMs: data.responseMs as number } }));
    } catch (caught) {
      setTests((current) => ({ ...current, [provider]: { state: "error", message: caught instanceof Error ? caught.message : "Connection test failed." } }));
    }
  };

  const isConfigured = (id: Provider | "asr" | "detection") => {
    if (id === "asr") return true;
    if (id === "detection") return detectionConfigured;
    return providers[id]?.configured === true;
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><Activity aria-hidden="true" className="size-3.5" />API INTEGRATIONS</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Provider connections</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">Connect each capability independently. Credentials stay in server environment variables and are never returned to the browser.</p>
        </div>
        <ShieldCheck aria-hidden="true" className="absolute -bottom-7 right-7 size-40 text-white/[0.035] sm:right-14" />
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.035] px-4 py-3.5 text-[11px] leading-5 text-cyan-100/75">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan-300" />
        <p>Provider secrets must be set by the server operator in <code className="rounded bg-black/20 px-1.5 py-0.5 text-cyan-100">frontend/.env.local</code> (or deployment secrets). This workspace intentionally does not store API keys in the browser or provide unauthenticated secret editing. Restart the server after changing environment values.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-xs text-rose-100">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        {providerCards.map(({ id, title, description, icon: Icon, envNames, testable }) => {
          const connected = isConfigured(id);
          const testResult = tests[id];
          return (
            <article key={id} className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/10 text-cyan-200"><Icon aria-hidden="true" className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${loading ? "border-white/10 text-slate-400" : connected ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200" : "border-amber-300/15 bg-amber-300/[0.05] text-amber-200"}`}>
                      <span className={`size-1 rounded-full ${loading ? "bg-slate-500" : connected ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {loading ? "Checking" : connected ? (id === "asr" ? "Configured · check on use" : "Configured") : "Not configured"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{description}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#071631] p-3.5">
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">Server configuration</p>
                <div className="space-y-1.5">
                  {envNames.map((name) => <div key={name} className="flex items-center justify-between gap-3 text-[10px]">
                    <code className="truncate text-slate-400">{name}</code>
                    <span className={`shrink-0 ${name.endsWith("_API_KEY") ? ((id === "detection" ? detectionHasApiKey : providers[id]?.hasApiKey) ? "text-emerald-300" : "text-slate-600") : connected ? "text-emerald-300" : "text-slate-600"}`}>
                      {name.endsWith("_API_KEY")
                        ? (id === "detection" ? detectionHasApiKey : providers[id]?.hasApiKey)
                          ? "•••• set"
                          : "optional · not set"
                        : connected ? "configured" : "not set"}
                    </span>
                  </div>)}
                </div>
                {providers[id]?.model && <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] text-slate-400">Model <span className="ml-1 font-medium text-slate-200">{providers[id].model}</span></p>}
              </div>
              {testResult && (
                <p role={testResult.state === "error" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 text-[10px] leading-5 ${testResult.state === "error" ? "text-rose-200" : testResult.state === "connected" ? "text-emerald-200" : "text-cyan-200"}`}>
                  {testResult.state === "testing" ? <LoaderCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 animate-spin" /> : testResult.state === "error" ? <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}
                  <span>{testResult.message}{testResult.responseMs !== undefined ? ` · ${testResult.responseMs} ms` : ""}</span>
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {testable ? (
                  <button type="button" onClick={() => void test(id as Provider)} disabled={!connected || testResult?.state === "testing"} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 text-[10px] font-medium text-slate-200 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40">
                    {testResult?.state === "testing" ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Activity aria-hidden="true" className="size-3.5" />}
                    Test connection
                  </button>
                ) : <span className="text-[9px] text-slate-500">{id === "asr" ? "KasaSpeech endpoint is verified on request." : "Test by submitting an audio clip in Live Translate."}</span>}
                <span className="inline-flex items-center gap-1 text-[9px] text-slate-500"><Clock3 aria-hidden="true" className="size-3" />{testResult?.state === "connected" ? "Just tested" : "Not tested"}</span>
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Configure a provider</h2>
        <p className="mt-1.5 max-w-3xl text-[11px] leading-5 text-slate-400">Copy the environment template, set server-side values, then restart Next.js. Translation and assistant support OpenAI-compatible chat completions and generic JSON REST payloads; TTS expects an audio response. Language detection expects multipart audio and JSON containing a language code and optional confidence.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            ["OpenAI-compatible", "Set an API URL, secret key and model identifier. Use the complete chat-completions or speech endpoint URL."],
            ["Custom REST", "Set the corresponding FORMAT=rest value. Requests carry JSON fields for task, model, text, sourceLanguage, targetLanguage and voice."],
            ["Language detection", "Configure an endpoint accepting multipart audio and returning { language: \"en\", confidence: 0.9 }. The score must be 0–1."],
          ].map(([label, body]) => <div key={label} className="rounded-xl border border-white/[0.06] bg-[#071631] p-3.5"><p className="text-[11px] font-semibold text-slate-200">{label}</p><p className="mt-1.5 text-[10px] leading-5 text-slate-500">{body}</p></div>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/models" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-cyan-300 hover:text-white">View configured models <ExternalLink aria-hidden="true" className="size-3" /></Link>
          <a href="https://platform.openai.com/docs/api-reference" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-white">OpenAI-compatible API docs <ExternalLink aria-hidden="true" className="size-3" /></a>
        </div>
      </section>
    </div>
  );
}

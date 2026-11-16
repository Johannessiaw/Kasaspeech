"use client";

import {
  ArrowDownUp,
  ArrowRight,
  Bot,
  Check,
  Clipboard,
  Download,
  FileText,
  Languages,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { languages, languageName } from "@/lib/languages";
import { readPreferences } from "@/lib/user-preferences";
import { takeWorkspaceDraft } from "@/lib/workspace-draft";

type Task = "translation" | "assistant" | "tts";
type Message = { role: "user" | "assistant"; text: string };

const headings: Record<Task, { title: string; subtitle: string; icon: typeof Languages; tag: string }> = {
  translation: {
    title: "Language translator",
    subtitle: "Translate text with a connected provider. Language availability depends on that provider.",
    icon: Languages,
    tag: "TRANSLATOR",
  },
  assistant: {
    title: "AI language assistant",
    subtitle: "Ask language questions, improve writing, summarize and explore words with your configured model.",
    icon: Bot,
    tag: "AI ASSISTANT",
  },
  tts: {
    title: "Text to speech",
    subtitle: "Generate audio through your connected speech provider. No sample audio is simulated.",
    icon: Volume2,
    tag: "VOICE STUDIO",
  },
};

function LanguageSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-[#dce4f2] bg-white px-3 text-xs font-medium text-[#1b2b4d] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
        {languages.map((language) => <option key={language.code} value={language.code}>{language.name} · {language.nativeName}</option>)}
      </select>
    </label>
  );
}

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LanguageTaskWorkspace({ task }: { task: Task }) {
  const { title, subtitle, icon: Icon, tag } = headings[task];
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("fr");
  const [voice, setVoice] = useState("alloy");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const preferences = readPreferences();
      setTargetLanguage(preferences.defaultLanguage);
      if (task === "tts") setSourceLanguage(preferences.defaultLanguage);
      try {
        const draft = takeWorkspaceDraft(task);
        if (draft) setText(draft);
      } catch {
        setError("Could not load the text shared from the previous workspace.");
      }
    });
    return () => {
      active = false;
    };
  }, [task]);

  useEffect(() => {
    let active = true;
    void fetch("/api/language", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check provider status.");
        const status: unknown = await response.json();
        if (typeof status !== "object" || status === null || !("providers" in status)) {
          throw new Error("Provider status response was invalid.");
        }
        const providers = (status as { providers: Record<string, { configured?: boolean }> }).providers;
        if (active) setConfigured(providers[task]?.configured === true);
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => {
      active = false;
    };
  }, [task]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const run = async () => {
    const prompt = text.trim();
    if (!prompt) {
      setError(task === "tts" ? "Enter text before generating speech." : "Enter text before continuing.");
      return;
    }
    if (prompt.length > 10_000) {
      setError("Text must be 10,000 characters or fewer.");
      return;
    }
    setBusy(true);
    setError("");
    setResult("");
    setCopied(false);
    try {
      const requestText =
        task === "assistant" && messages.length
          ? `${messages.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`).join("\n\n")}\n\nUser: ${prompt}`
          : prompt;
      const response = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          text: requestText,
          sourceLanguage,
          targetLanguage,
          voice,
        }),
      });
      if (task === "tts" && response.ok) {
        const blob = await response.blob();
        if (!blob.type.startsWith("audio/")) throw new Error("The provider did not return playable audio.");
        setAudioUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
        setResult("Audio generated by the connected provider.");
        return;
      }
      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null) throw new Error("The provider returned an invalid response.");
      if (!response.ok) {
        throw new Error("error" in data && typeof data.error === "string" ? data.error : `Request failed (${response.status}).`);
      }
      if (!("result" in data) || typeof data.result !== "string" || !data.result.trim()) {
        throw new Error("The provider response did not contain text.");
      }
      setResult(data.result);
      if (task === "assistant") {
        setMessages((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: data.result as string }]);
        setText("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy to clipboard. Check browser clipboard permissions.");
    }
  };

  const importText = async (file?: File) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("Text files must be 1 MB or smaller.");
      return;
    }
    try {
      setText(await file.text());
      setError("");
    } catch {
      setError("Could not read the selected text file.");
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canRun = configured === true && !busy;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><Icon aria-hidden="true" className="size-3.5" />{tag}</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">{subtitle}</p>
        </div>
        <Icon aria-hidden="true" className="absolute -bottom-7 right-7 size-40 rotate-[-12deg] text-white/[0.035] sm:right-14" />
      </section>

      {configured === false && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3.5 text-xs leading-5 text-amber-100/90 sm:flex-row sm:items-center sm:justify-between">
          <span>No {task === "tts" ? "text-to-speech" : task} provider is configured. Add server-only provider settings to enable real requests.</span>
          <a href="/integrations" className="shrink-0 font-semibold text-amber-100 underline decoration-amber-100/30 underline-offset-4">Provider setup</a>
        </div>
      )}
      {configured === null && <p role="status" className="text-xs text-slate-400">Checking provider configuration…</p>}
      {error && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-xs leading-5 text-rose-100">{error}</div>}

      {task === "assistant" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0a1c3d]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200"><Bot aria-hidden="true" className="size-4" /></span><span className="text-xs font-semibold text-slate-100">Conversation</span></div>
              <button type="button" onClick={() => { setMessages([]); setResult(""); setError(""); }} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white"><Trash2 aria-hidden="true" className="size-3.5" />Clear</button>
            </div>
            <div className="min-h-72 space-y-4 p-5">
              {messages.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200"><Sparkles aria-hidden="true" className="size-5" /></span>
                  <p className="text-sm font-medium text-slate-200">What would you like to work on?</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Ask for grammar help, a summary, a rewrite, or an explanation from your configured model.</p>
                </div>
              ) : messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                  {message.role === "assistant" && <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200"><Bot aria-hidden="true" className="size-3.5" /></span>}
                  <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-blue-600 text-white" : "border border-white/[0.07] bg-white/[0.035] text-slate-200"}`}>{message.text}</p>
                </div>
              ))}
              {busy && <div role="status" className="flex items-center gap-2 text-xs text-cyan-200"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Thinking with your provider…</div>}
            </div>
            <div className="border-t border-white/[0.07] p-4">
              <label htmlFor="assistant-prompt" className="sr-only">Your message</label>
              <textarea id="assistant-prompt" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void run(); } }} rows={3} maxLength={10_000} placeholder="Ask a language question or paste text to improve…" className="w-full resize-y rounded-xl border border-white/[0.09] bg-[#071631] p-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50" />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">Enter to send · Shift+Enter for a new line</span>
                <button type="button" onClick={() => void run()} disabled={!canRun || !text.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45">
                  {busy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <ArrowRight aria-hidden="true" className="size-3.5" />}
                  Send
                </button>
              </div>
            </div>
          </div>
          <aside className="h-fit rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><MessageSquareText aria-hidden="true" className="size-4 text-cyan-300" />Prompt ideas</div>
            <div className="mt-4 space-y-2">
              {["Correct the grammar and explain the changes.", "Summarize this text in three clear bullet points.", "Explain this phrase and give two examples."].map((idea) => (
                <button key={idea} type="button" onClick={() => setText(idea)} className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left text-[11px] leading-5 text-slate-300 transition hover:border-cyan-200/20 hover:bg-white/[0.04]">{idea}</button>
              ))}
            </div>
            <p className="mt-5 border-t border-white/[0.07] pt-4 text-[10px] leading-5 text-slate-500">Your prompts are sent only to the server-configured assistant provider. Conversation history stays in this tab.</p>
          </aside>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <div className="rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-white">{task === "translation" ? "Your text" : "Text input"}</h2><p className="mt-1 text-[11px] text-slate-500">{task === "translation" ? "Source language" : "Paste text or import a .txt file"}</p></div>
              {task === "tts" && <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-2 text-[11px] text-slate-300 transition hover:bg-white/[0.04]"><FileText aria-hidden="true" className="size-3.5" />Import text</button>}
              <input ref={fileInput} type="file" accept=".txt,text/plain" className="hidden" onChange={(event) => { void importText(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            </div>

            {task === "translation" && (
              <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:gap-3">
                <LanguageSelect label="From" value={sourceLanguage} onChange={setSourceLanguage} />
                <button type="button" aria-label="Swap source and target languages" onClick={() => { setSourceLanguage(targetLanguage); setTargetLanguage(sourceLanguage); }} className="mb-0.5 flex size-9 items-center justify-center rounded-lg border border-[#dce4f2] bg-white text-[#526184] transition hover:border-blue-300 hover:text-blue-600"><ArrowDownUp aria-hidden="true" className="size-4" /></button>
                <LanguageSelect label="To" value={targetLanguage} onChange={setTargetLanguage} />
              </div>
            )}

            <label htmlFor="language-input" className="sr-only">{task === "translation" ? "Text to translate" : "Text to speak"}</label>
            <textarea id="language-input" value={text} onChange={(event) => setText(event.target.value)} maxLength={10_000} dir={languages.find((item) => item.code === (task === "translation" ? sourceLanguage : "en"))?.direction ?? "auto"} rows={task === "translation" ? 11 : 9} placeholder={task === "translation" ? "Type or paste text to translate…" : "Enter the text you want spoken aloud…"} className="w-full resize-y rounded-xl border border-[#dce4f2] bg-white p-4 text-sm leading-6 text-[#17264a] outline-none placeholder:text-[#97a3ba] focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
              <span>{text.length.toLocaleString()} characters · {wordCount.toLocaleString()} words</span>
              <button type="button" onClick={() => { setText(""); setError(""); }} disabled={!text} className="text-slate-400 transition hover:text-white disabled:opacity-40">Clear</button>
            </div>

            {task === "tts" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <LanguageSelect label="Voice language" value={sourceLanguage} onChange={setSourceLanguage} />
                <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Voice ID</span><input value={voice} onChange={(event) => setVoice(event.target.value)} maxLength={80} className="h-10 w-full rounded-lg border border-[#dce4f2] bg-white px-3 text-xs text-[#1b2b4d] outline-none focus:border-blue-400" placeholder="Provider voice name" /></label>
              </div>
            )}

            <button type="button" onClick={() => void run()} disabled={!canRun || !text.trim()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(27,119,255,.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Icon aria-hidden="true" className="size-4" />}
              {busy ? "Waiting for provider…" : task === "translation" ? `Translate to ${languageName(targetLanguage)}` : "Generate speech"}
            </button>
          </div>

          <div className="flex min-h-[350px] flex-col rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">{task === "translation" ? languageName(targetLanguage) : "PROVIDER OUTPUT"}</p><h2 className="mt-1 text-sm font-semibold text-white">{task === "translation" ? "Translation" : "Generated audio"}</h2></div>
              {result && task === "translation" && <div className="flex gap-1.5">
                <button type="button" aria-label="Copy result" onClick={() => void copyResult()} className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-300 hover:bg-white/[0.05]">{copied ? <Check aria-hidden="true" className="size-3.5" /> : <Clipboard aria-hidden="true" className="size-3.5" />}</button>
                <button type="button" aria-label="Download translation" onClick={() => downloadText(result, "lingua-translation.txt")} className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-300 hover:bg-white/[0.05]"><Download aria-hidden="true" className="size-3.5" /></button>
              </div>}
            </div>
            {result ? (
              task === "tts" && audioUrl ? (
                <div className="my-auto rounded-2xl border border-cyan-200/10 bg-[#071631] p-5">
                  <div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><Volume2 aria-hidden="true" className="size-5" /></span><div><p className="text-xs font-semibold text-white">Speech ready</p><p className="mt-1 text-[10px] text-slate-500">Audio returned by your provider</p></div></div>
                  <audio controls src={audioUrl} className="w-full" aria-label="Generated speech audio" />
                  <a href={audioUrl} download="lingua-speech.mp3" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-white"><Download aria-hidden="true" className="size-3.5" />Download audio</a>
                </div>
              ) : task === "translation" ? (
                <p dir={languages.find((item) => item.code === targetLanguage)?.direction ?? "auto"} className="flex-1 whitespace-pre-wrap rounded-xl border border-cyan-200/[0.08] bg-[#071631] p-4 text-sm leading-7 text-slate-200">{result}</p>
              ) : null
            ) : (
              <div className="my-auto flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.015] px-5 text-center">
                <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500"><Icon aria-hidden="true" className="size-5" /></span>
                <p className="text-xs font-medium text-slate-300">Output will appear here</p>
                <p className="mt-1.5 max-w-xs text-[10px] leading-5 text-slate-500">A result is shown only after a connected provider returns one successfully.</p>
              </div>
            )}
            {busy && <p role="status" className="mt-3 flex items-center gap-2 text-[11px] text-cyan-200"><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />Processing with your configured model…</p>}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Activity, AudioLines, Clock3, Languages, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listTranscriptions, type TranscriptionEntry } from "@/lib/transcription-history";

type ActivityDay = { label: string; count: number };

function activityForLastSevenDays(entries: TranscriptionEntry[]): ActivityDay[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const count = entries.filter((entry) => new Date(entry.createdAt).toDateString() === date.toDateString()).length;
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), count };
  });
}

export default function AnalyticsPage() {
  const [entries, setEntries] = useState<TranscriptionEntry[]>([]);
  const [lastSevenDays, setLastSevenDays] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listTranscriptions()
      .then((history) => {
        if (active) {
          setEntries(history);
          setLastSevenDays(activityForLastSevenDays(history));
        }
      })
      .catch(() => {
        if (active) setError("Could not read local transcription history for analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const averageMs = entries.length
    ? Math.round(entries.reduce((sum, item) => sum + item.processingMs, 0) / entries.length)
    : null;
  const maxCount = Math.max(1, ...lastSevenDays.map((day) => day.count));
  const hasRecentActivity = lastSevenDays.some((day) => day.count > 0);

  const metrics = [
    { title: "Saved ASR results", value: loading ? "…" : entries.length.toLocaleString(), detail: "Completed items in this browser", icon: AudioLines, color: "text-cyan-200" },
    { title: "Average ASR time", value: averageMs === null ? "—" : `${(averageMs / 1000).toFixed(1)}s`, detail: averageMs === null ? "No measured requests yet" : "Successful saved transcriptions", icon: Clock3, color: "text-violet-200" },
    { title: "Translations", value: "Not measured", detail: "No persistent translation event store", icon: Languages, color: "text-teal-200" },
    { title: "Speech generation", value: "Not measured", detail: "No persistent TTS event store", icon: Volume2, color: "text-amber-200" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><Activity aria-hidden="true" className="size-3.5" />ANALYTICS</span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Usage & performance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">This page uses measured browser-local transcription records only. Unmeasured provider activity is clearly marked rather than estimated.</p>
      </section>
      {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-3 text-xs text-rose-100">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, value, detail, icon: Icon, color }) => <article key={title} className="rounded-[18px] border border-white/[0.08] bg-[#0a1c3d] p-4">
          <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-slate-400">{title}</span><Icon aria-hidden="true" className={`size-4 ${color}`} /></div>
          <p className="mt-4 text-xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
        </article>)}
      </section>
      <section className="rounded-[20px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-white">Saved transcriptions · last 7 days</h2><p className="mt-1 text-[10px] text-slate-500">Counts are derived from successful records saved in this browser.</p></div>
          <Link href="/asr" className="text-[10px] font-medium text-cyan-300 hover:text-white">View transcription history →</Link>
        </div>
        {loading ? <p role="status" className="py-16 text-center text-xs text-slate-500">Loading measured activity…</p> : entries.length && hasRecentActivity ? (
          <div className="mt-7 grid h-48 grid-cols-7 items-end gap-3 border-b border-white/[0.07] px-2">
            {lastSevenDays.map(({ label, count }) => <div key={label} className="flex h-full flex-col items-center justify-end gap-2">
              <span className="text-[9px] text-slate-500">{count || ""}</span>
              <div className="w-full max-w-12 rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 transition-all" style={{ height: `${Math.max(4, (count / maxCount) * 126)}px` }} />
              <span className="pb-2 text-[9px] text-slate-500">{label}</span>
            </div>)}
          </div>
        ) : <div className="flex min-h-52 flex-col items-center justify-center text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500"><AudioLines aria-hidden="true" className="size-5" /></span>
          <h3 className="text-xs font-medium text-slate-300">No measured activity yet</h3>
          <p className="mt-1 max-w-sm text-[10px] leading-5 text-slate-500">Completed speech recognition results appear after you save them to this browser. Other usage metrics require persistent event storage.</p>
        </div>}
      </section>
    </div>
  );
}

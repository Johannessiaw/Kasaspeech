"use client";

import Link from "next/link";
import {
  AlertCircle,
  AudioLines,
  Check,
  Clipboard,
  Download,
  Headphones,
  Mic,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteTranscription,
  listTranscriptions,
  type TranscriptionEntry,
} from "@/lib/transcription-history";

function AudioPreview({ entry }: { entry: TranscriptionEntry }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const player = audioRef.current;
    const url = URL.createObjectURL(entry.audio);
    if (player) player.src = url;
    return () => {
      if (player) {
        player.pause();
        player.removeAttribute("src");
      }
      URL.revokeObjectURL(url);
    };
  }, [entry.audio]);

  const downloadAudio = () => {
    const url = URL.createObjectURL(entry.audio);
    const link = document.createElement("a");
    link.href = url;
    link.download = entry.fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-background/50 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200">
          <Headphones aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Original audio</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Play back the audio used for this transcription.
          </p>
        </div>
      </div>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        className="h-12 w-full"
        aria-label={`Play ${entry.fileName}`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadAudio}
        className="mt-4 gap-2"
      >
        <Download aria-hidden="true" className="size-3.5" />
        Download original audio
      </Button>
    </div>
  );
}

function TranscriptionCard({
  entry,
  onDelete,
}: {
  entry: TranscriptionEntry;
  onDelete: (id: string) => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(entry.transcript);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border/60 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AudioLines aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base font-semibold">
              {entry.fileName}
            </CardTitle>
            <CardDescription className="mt-1.5 text-xs">
              {new Date(entry.createdAt).toLocaleString()} ·{" "}
              {Math.max(1, Math.round(entry.audio.size / 1024))} KB ·{" "}
              {(entry.processingMs / 1000).toFixed(1)}s round trip
            </CardDescription>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(entry.id)}
          aria-label={`Delete ${entry.fileName} from this browser`}
          title="Delete from this browser"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5 pt-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] lg:gap-6">
        <AudioPreview entry={entry} />
        <div className="flex min-h-64 flex-col rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-violet-200/80">
                ASR result
              </p>
              <h3 className="mt-1 text-sm font-semibold">Transcription</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyTranscript()}
              disabled={!entry.transcript}
              className="gap-1.5"
            >
              {copyState === "copied" ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <Clipboard aria-hidden="true" className="size-3.5" />
              )}
              {copyState === "copied"
                ? "Copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy transcript"}
            </Button>
          </div>
          <p className="flex-1 whitespace-pre-wrap text-base leading-7 text-foreground sm:text-lg sm:leading-8">
            {entry.transcript || (
              <span className="italic text-muted-foreground">
                The endpoint returned an empty transcript for this audio.
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TranscriptionHistory() {
  const [entries, setEntries] = useState<TranscriptionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [endpointStatus, setEndpointStatus] = useState<
    "checking" | "ready" | "missing" | "unavailable"
  >("checking");

  useEffect(() => {
    let active = true;
    void listTranscriptions()
      .then((history) => {
        if (active) setEntries(history);
      })
      .catch(() => {
        if (active) {
          setError(
            "Could not read local history. Check that this browser allows site storage.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/transcriptions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check the ASR configuration.");
        const status: unknown = await response.json();
        if (
          typeof status !== "object" ||
          status === null ||
          !("configured" in status) ||
          typeof status.configured !== "boolean"
        ) {
          throw new Error("The ASR configuration response was invalid.");
        }
        if (active) {
          setEndpointStatus(status.configured ? "ready" : "missing");
        }
      })
      .catch(() => {
        if (active) setEndpointStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  const removeEntry = async (id: string) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry || !window.confirm(`Delete "${entry.fileName}" from this browser’s history?`)) {
      return;
    }

    setError("");
    try {
      await deleteTranscription(id);
      setEntries((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Could not delete this item from local history. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-violet-500/[0.10] via-card/70 to-sky-400/[0.06] p-6 sm:p-8 lg:p-10">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border border-primary/25 bg-primary/15 text-violet-100 hover:bg-primary/15">
              <AudioLines aria-hidden="true" />
              Hosted ASR · browser history
            </Badge>
            <Badge
              variant="outline"
              className={
                endpointStatus === "ready"
                  ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-200"
                  : "border-amber-300/25 bg-amber-300/[0.07] text-amber-200"
              }
            >
              {endpointStatus === "checking"
                ? "Checking endpoint…"
                : endpointStatus === "ready"
                  ? "Server credentials configured"
                  : endpointStatus === "missing"
                    ? "Endpoint setup required"
                    : "Endpoint status unavailable"}
            </Badge>
            {!isLoading && !error && (
              <span className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "transcription" : "transcriptions"}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            ASR transcription workspace
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            Listen to each original recording while reviewing its recognized
            speech. Transcripts and audio saved from Speech Studio appear here.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            nativeButton={false}
            render={<Link href="/studio" />}
            className="h-10 gap-2 bg-violet-500 px-4 text-white hover:bg-violet-400"
          >
            <Mic aria-hidden="true" className="size-4" />
            Open Speech Studio
          </Button>
          {!isLoading && !error && (
            <span className="text-sm text-muted-foreground">
              {entries.length} saved{" "}
              {entries.length === 1 ? "transcription" : "transcriptions"}
            </span>
          )}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.05] px-4 py-3.5 text-xs leading-5 text-sky-100/80">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          Audio and transcripts are stored in this browser only. Clearing
          browser site data removes them; this history does not sync to other
          devices or get saved to a KasaSpeech server.
        </p>
      </div>

      {endpointStatus === "missing" && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3.5 text-sm leading-6 text-amber-100/90">
          Hosted transcription is not configured in this Codespace yet. Add
          KASASPEECH_ASR_ENDPOINT_URL and HF_TOKEN as server-side Codespaces
          secrets, then restart the app. Never put HF_TOKEN in frontend code or
          a NEXT_PUBLIC_ variable.
        </div>
      )}
      {endpointStatus === "unavailable" && (
        <div
          role="alert"
          className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-100"
        >
          Could not check hosted ASR configuration. Reload the page and check
          that the application server is running.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div
          role="status"
          className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center text-sm text-muted-foreground"
        >
          Loading browser history…
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map((entry) => (
            <TranscriptionCard
              key={entry.id}
              entry={entry}
              onDelete={(id) => void removeEntry(id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AudioLines aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-base font-medium">No transcriptions yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Record or choose an audio clip in Speech Studio, then select
            Transcribe. Completed audio and model output will appear here.
          </p>
          <Link
            href="/studio"
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Mic aria-hidden="true" className="size-4" />
            Go to Speech Studio
          </Link>
        </div>
      )}
    </div>
  );
}

"use client";

import {
  AudioLines,
  CheckCircle2,
  CircleAlert,
  Languages,
  LoaderCircle,
  Mic,
  Play,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveTranscription } from "@/lib/transcription-history";
import { languages, languageName } from "@/lib/languages";
import { readPreferences } from "@/lib/user-preferences";

type DetectionResult = { language: string; confidence: number | null };

export function LiveTranslateWorkspace() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [detected, setDetected] = useState<DetectionResult | null>(null);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [processing, setProcessing] = useState<"" | "recording" | "transcribing" | "translating">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detectionConfigured, setDetectionConfigured] = useState(false);
  const [translationConfigured, setTranslationConfigured] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const preferences = readPreferences();
      setTargetLanguage(preferences.defaultLanguage);
      setSourceLanguage(preferences.automaticDetection ? "auto" : preferences.defaultLanguage);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/language", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const status: unknown = await response.json();
        if (typeof status !== "object" || status === null || !("providers" in status)) return;
        const providerStatus = status as {
          providers: Record<string, { configured?: boolean }>;
          detectionConfigured?: boolean;
        };
        const providers = providerStatus.providers;
        if (active) {
          setDetectionConfigured(providerStatus.detectionConfigured === true);
          setTranslationConfigured(providers.translation?.configured === true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const audioUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : ""),
    [audioFile],
  );
  useEffect(() => {
    if (audioUrl) return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const selectFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Choose an audio file. Supported formats include WAV, MP3, M4A, FLAC, OGG and WebM.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Audio files must be 50 MB or smaller.");
      return;
    }
    setAudioFile(file);
    setTranscript("");
    setTranslation("");
    setDetected(null);
    setSourceConfirmed(sourceLanguage !== "auto");
    setError("");
    setNotice("");
  };

  const startRecording = async () => {
    setError("");
    setNotice("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone recording is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        selectFile(new File([blob], `live-translate-${Date.now()}.${extension}`, { type: blob.type }));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setProcessing("");
      };
      recorderRef.current = recorder;
      recorder.start();
      setProcessing("recording");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start microphone recording.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const transcribe = async () => {
    if (!audioFile || processing) return;
    setError("");
    setNotice("");
    setTranscript("");
    setTranslation("");
    setDetected(null);
    setProcessing("transcribing");
    let detection: DetectionResult | null = null;
    let detectionFailure = "";
    if (sourceLanguage === "auto" && detectionConfigured) {
      try {
        const detectForm = new FormData();
        detectForm.append("audio", audioFile, audioFile.name);
        const response = await fetch("/api/language/detect", { method: "POST", body: detectForm });
        const result: unknown = await response.json();
        if (!response.ok) {
          detectionFailure =
            typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
              ? result.error
              : "Language detection failed.";
        } else if (
          typeof result === "object" &&
          result !== null &&
          "language" in result &&
          typeof result.language === "string" &&
          "confidence" in result &&
          (typeof result.confidence === "number" || result.confidence === null)
        ) {
          detection = { language: result.language, confidence: result.confidence };
          setDetected(detection);
          setSourceLanguage(detection.language);
          setSourceConfirmed(detection.confidence !== null && detection.confidence >= 0.65);
        } else {
          detectionFailure = "The detection provider returned an invalid result.";
        }
      } catch {
        detectionFailure = "Could not reach the language-detection provider.";
      }
    }

    try {
      const formData = new FormData();
      formData.append("audio", audioFile, audioFile.name);
      const response = await fetch("/api/transcriptions", { method: "POST", body: formData });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : `Transcription failed (${response.status}).`,
        );
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("transcript" in result) ||
        typeof result.transcript !== "string" ||
        !("processingMs" in result) ||
        typeof result.processingMs !== "number"
      ) {
        throw new Error("The ASR service returned an invalid transcript.");
      }
      const recognized = result.transcript.trim();
      setTranscript(recognized);
      try {
        await saveTranscription({
          id: crypto.randomUUID(),
          audio: audioFile,
          fileName: audioFile.name,
          mimeType: audioFile.type || "audio/unknown",
          transcript: recognized,
          durationSeconds: 0,
          processingMs: result.processingMs,
          createdAt: new Date().toISOString(),
        });
      } catch {
        setNotice("Transcription succeeded. This browser could not save it to local history.");
      }

      const source = detection?.language ?? (sourceLanguage === "auto" ? "" : sourceLanguage);
      const isConfident = detection
        ? detection.confidence !== null && detection.confidence >= 0.65
        : sourceLanguage !== "auto";
      if (source && isConfident && translationConfigured && recognized) {
        await translateText(recognized, source);
      } else if (detectionFailure) {
        setNotice(`Transcript preserved. ${detectionFailure} Select the source language to continue.`);
      } else if (!source) {
        setNotice("Transcript preserved. No language was detected; select the source language to translate.");
      } else if (!isConfident) {
        setNotice("Transcript preserved. Detection confidence is low or unavailable; confirm the source language before translating.");
      } else if (!translationConfigured) {
        setNotice("Transcript preserved. Configure a translation provider to translate this language pair.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transcription failed. Try another audio file.");
    } finally {
      setProcessing("");
    }
  };

  const translateText = async (text = transcript, source = sourceLanguage) => {
    if (!text.trim() || source === "auto") {
      setError("Select a source language and transcribe audio before translating.");
      return;
    }
    setProcessing("translating");
    setError("");
    try {
      const response = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "translation", text, sourceLanguage: source, targetLanguage }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : `Translation failed (${response.status}).`,
        );
      }
      if (typeof result !== "object" || result === null || !("result" in result) || typeof result.result !== "string") {
        throw new Error("The translation provider returned an invalid result.");
      }
      setTranslation(result.result);
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Translation failed.");
    } finally {
      setProcessing("");
    }
  };

  const changeSource = (value: string) => {
    setSourceLanguage(value);
    setSourceConfirmed(value !== "auto");
    setDetected(null);
    setTranslation("");
  };

  const confirmDetected = () => {
    if (sourceLanguage === "auto") return;
    setSourceConfirmed(true);
    void translateText(transcript, sourceLanguage);
  };

  const sourceLabel = sourceLanguage === "auto" ? "Not detected" : languageName(sourceLanguage);
  const selectedSource = languages.find((language) => language.code === sourceLanguage);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-blue-200/10 bg-[linear-gradient(112deg,#0d2860,#102556_53%,#0b3451)] px-6 py-7 sm:px-8 sm:py-8">
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-cyan-100"><Languages aria-hidden="true" className="size-3.5" />LIVE TRANSLATE</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Speech to translation</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/70">Record or upload a clip, transcribe it with KasaSpeech, then translate the original speech using your connected language provider.</p>
        </div>
        <AudioLines aria-hidden="true" className="absolute -bottom-7 right-7 size-40 rotate-[-12deg] text-white/[0.035] sm:right-14" />
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0a1c3d] px-4 py-3 text-[11px] leading-5 text-slate-400">
        <span className="mr-1 font-semibold text-slate-200">Batch mode</span>
        <span>Audio is processed after recording or upload; partial streaming results are not available with the current KasaSpeech endpoint.</span>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-xs leading-5 text-rose-100">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/90">{notice}</div>}

      <section className="grid gap-4 xl:grid-cols-[minmax(300px,.78fr)_minmax(0,1.22fr)]">
        <div className="space-y-4 rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-white">Audio input</h2><p className="mt-1 text-[11px] text-slate-500">Microphone recording or audio file</p></div>
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-400/10 text-blue-200"><Mic aria-hidden="true" className="size-4" /></span>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-white/[0.07] bg-[#071631] px-4 py-7 text-center">
            <button type="button" onClick={processing === "recording" ? stopRecording : () => void startRecording()} disabled={processing !== "" && processing !== "recording"} aria-label={processing === "recording" ? "Stop recording" : "Start microphone recording"} className={`flex size-[76px] items-center justify-center rounded-full text-white shadow-[0_0_0_9px_rgba(74,132,255,.07)] transition ${processing === "recording" ? "animate-pulse bg-rose-500 hover:bg-rose-400" : "bg-gradient-to-br from-blue-500 to-cyan-400 hover:brightness-110"}`}>
              {processing === "recording" ? <Square aria-hidden="true" className="size-6 fill-current" /> : <Mic aria-hidden="true" className="size-7" />}
            </button>
            <p className="mt-4 text-xs font-medium text-slate-200">{processing === "recording" ? "Recording · select stop when finished" : "Tap to record speech"}</p>
            <p className="mt-1 text-[10px] text-slate-500">Microphone permission is requested by your browser.</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(processing)} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-40"><Upload aria-hidden="true" className="size-3.5" />Choose audio file</button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(event) => { selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          </div>
          {audioFile && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
              <div className="flex items-center gap-2.5">
                <AudioLines aria-hidden="true" className="size-4 shrink-0 text-cyan-300" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-200">{audioFile.name}</span>
                <span className="shrink-0 text-[9px] text-slate-500">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              {audioUrl && <audio controls src={audioUrl} className="mt-3 h-9 w-full" aria-label="Preview selected audio" />}
              <button type="button" onClick={() => { setAudioFile(null); setTranscript(""); setTranslation(""); setDetected(null); }} disabled={Boolean(processing)} className="mt-2 text-[10px] text-slate-500 hover:text-white">Remove audio</button>
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Source language</span>
            <select value={sourceLanguage} onChange={(event) => changeSource(event.target.value)} className="h-10 w-full rounded-lg border border-white/[0.1] bg-[#071631] px-3 text-xs text-slate-200 outline-none focus:border-blue-400/60">
              <option value="auto">Detect automatically</option>
              {languages.map((language) => <option key={language.code} value={language.code}>{language.name} · {language.nativeName}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Translate to</span>
            <select value={targetLanguage} onChange={(event) => { setTargetLanguage(event.target.value); setTranslation(""); }} className="h-10 w-full rounded-lg border border-white/[0.1] bg-[#071631] px-3 text-xs text-slate-200 outline-none focus:border-blue-400/60">
              {languages.map((language) => <option key={language.code} value={language.code}>{language.name} · {language.nativeName}</option>)}
            </select>
          </label>
          {sourceLanguage === "auto" && !detectionConfigured && <p className="flex gap-2 text-[10px] leading-5 text-amber-200/80"><CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />No language-detection provider configured. Choose the spoken language above to enable translation.</p>}
          {detectionConfigured && <p className="text-[10px] leading-5 text-slate-500">Automatic detection runs only if you leave the source language on Detect automatically.</p>}
          <button type="button" onClick={() => void transcribe()} disabled={!audioFile || Boolean(processing)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
            {processing === "transcribing" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-4 fill-current" />}
            {processing === "transcribing" ? "Processing audio…" : "Transcribe and translate"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">ORIGINAL SPEECH</p><h2 className="mt-1 text-sm font-semibold text-white">Transcription</h2></div>
              {transcript && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-[9px] text-emerald-200"><CheckCircle2 aria-hidden="true" className="size-3" />Transcript preserved</span>}
            </div>
            <div className="min-h-32 whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-[#071631] p-4 text-sm leading-7 text-slate-200">
              {transcript || <span className="text-xs text-slate-600">Recognized speech will appear here after transcription.</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                <span className="font-semibold text-slate-200">{sourceLabel}</span>
                {detected && <span className={`rounded-full px-2 py-1 ${detected.confidence !== null && detected.confidence >= 0.65 ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>
                  {detected.confidence === null ? "Confidence not provided" : `${Math.round(detected.confidence * 100)}% confidence`}
                </span>}
              </div>
              {detected && !sourceConfirmed && transcript && <button type="button" onClick={confirmDetected} disabled={Boolean(processing)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/20 px-2.5 py-1.5 text-[10px] font-medium text-amber-100 hover:bg-amber-200/[0.05] disabled:opacity-40"><CheckCircle2 aria-hidden="true" className="size-3" />Confirm {languageName(detected.language)}</button>}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/[0.08] bg-[#0a1c3d] p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-300">TRANSLATION</p><h2 className="mt-1 text-sm font-semibold text-white">{languageName(targetLanguage)}</h2></div>
              {translation && <button type="button" onClick={() => void navigator.clipboard.writeText(translation).catch(() => setError("Could not copy the translation."))} className="text-[10px] text-slate-400 hover:text-white">Copy translation</button>}
            </div>
            <div dir={languages.find((language) => language.code === targetLanguage)?.direction ?? "auto"} className="min-h-32 whitespace-pre-wrap rounded-xl border border-violet-200/[0.08] bg-[#071631] p-4 text-sm leading-7 text-slate-200">
              {translation || <span className="text-xs text-slate-600">The translation provider result will appear here.</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] text-slate-500">{translation ? `${sourceLabel} → ${languageName(targetLanguage)}` : "Original transcript stays available if translation is not configured."}</span>
              {transcript && sourceLanguage !== "auto" && sourceConfirmed && !translation && <button type="button" onClick={() => void translateText()} disabled={!translationConfigured || Boolean(processing)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">
                {processing === "translating" ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Languages aria-hidden="true" className="size-3.5" />}
                {translationConfigured ? "Translate transcript" : "Configure translation API"}
              </button>}
              {translation && <button type="button" onClick={() => { const utterance = new SpeechSynthesisUtterance(translation); utterance.lang = targetLanguage; window.speechSynthesis.speak(utterance); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] text-slate-300 hover:bg-white/[0.04]"><Volume2 aria-hidden="true" className="size-3.5" />Listen</button>}
            </div>
            {translation && <p className="mt-3 text-[9px] leading-4 text-slate-600">Playback uses the browser&apos;s available speech synthesis voice, not your configured TTS provider.</p>}
          </div>

          {detected && <div className="flex items-start gap-2 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.035] px-4 py-3 text-[10px] leading-5 text-cyan-100/75"><Languages aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span>Detected language: <strong className="text-cyan-100">{languageName(detected.language)}</strong>{detected.confidence === null ? " · The detection provider did not return a confidence score." : ` · ${Math.round(detected.confidence * 100)}% confidence.`} {selectedSource?.direction === "rtl" ? "Right-to-left text layout enabled." : ""}</span></div>}
        </div>
      </section>
    </div>
  );
}

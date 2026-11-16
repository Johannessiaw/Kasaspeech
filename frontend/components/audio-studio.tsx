"use client";

import {
  AudioLines,
  Check,
  CircleAlert,
  Download,
  FileAudio2,
  Headphones,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Volume2,
  Waves,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
  saveTranscription,
  type TranscriptionEntry,
} from "@/lib/transcription-history";
import { saveWorkspaceDraft } from "@/lib/workspace-draft";

const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/webm",
]);
const ACCEPTED_AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|flac|ogg|webm)$/i;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const WAVEFORM_BARS = 360;
const EMPTY_WAVEFORM: number[] = [];

type AudioAsset = {
  url: string;
  blob: Blob;
  name: string;
  size: number;
  mimeType: string;
  source: "recording" | "upload";
};

type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "processing";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (wholeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function supportsAudioFile(file: File) {
  return (
    ACCEPTED_AUDIO_TYPES.has(file.type.toLowerCase()) ||
    ACCEPTED_AUDIO_EXTENSIONS.test(file.name)
  );
}

function errorMessage(error: unknown) {
  const name =
    error instanceof DOMException || error instanceof Error ? error.name : "";

  if (name === "NotAllowedError") {
    return "Microphone access was denied. Allow microphone access in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found. Connect a microphone and try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The browser could not open the microphone. Close other tabs or apps using it (such as calls or voice recorders), check your device’s microphone privacy settings, then retry. You can also load an audio file below.";
  }
  if (name === "SecurityError") {
    return "The browser blocked microphone access for security reasons. Open KasaSpeech over HTTPS or localhost and check the browser’s site permissions.";
  }
  if (name === "OverconstrainedError") {
    return "The microphone does not support the requested settings. Check your selected input device or use an audio file instead.";
  }
  if (name === "NotSupportedError") {
    return "This browser cannot play this audio format or continue the recording.";
  }
  return "The audio operation failed. Check your microphone or file and try again.";
}

async function extractWaveform(blob: Blob) {
  const audioContext = new window.AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index),
    );
    const peaks = new Array<number>(WAVEFORM_BARS);
    const samplesPerBar = Math.max(1, Math.floor(decoded.length / WAVEFORM_BARS));

    for (let bar = 0; bar < WAVEFORM_BARS; bar += 1) {
      const start = bar * samplesPerBar;
      const end = Math.min(decoded.length, start + samplesPerBar);
      let sum = 0;
      for (const channel of channels) {
        for (let sample = start; sample < end; sample += 1) {
          sum += channel[sample] * channel[sample];
        }
      }
      const sampleCount = (end - start) * channels.length;
      peaks[bar] = sampleCount ? Math.sqrt(sum / sampleCount) : 0;
    }

    return peaks;
  } finally {
    await audioContext.close();
  }
}

function Waveform({
  peaks,
  analyser,
  live,
  progress,
  onSeek,
}: {
  peaks: number[];
  analyser: AnalyserNode | null;
  live: boolean;
  progress: number;
  onSeek: (position: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || (live && !analyser)) return;

    let frameId = 0;
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        if (live) frameId = window.requestAnimationFrame(draw);
        return;
      }

      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.floor(bounds.width * pixelRatio);
      const height = Math.floor(bounds.height * pixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.clearRect(0, 0, width, height);

      const count = live && analyser ? 100 : peaks.length;
      const gap = Math.max(1, pixelRatio * 1.5);
      const barWidth = Math.max(1, width / Math.max(1, count) - gap);
      const center = height / 2;
      const liveData = live && analyser ? new Uint8Array(analyser.fftSize) : null;
      if (liveData && analyser) analyser.getByteTimeDomainData(liveData);

      for (let index = 0; index < count; index += 1) {
        let amplitude = 0.035;
        if (liveData) {
          const start = Math.floor((index / count) * liveData.length);
          const end = Math.max(
            start + 1,
            Math.floor(((index + 1) / count) * liveData.length),
          );
          let sum = 0;
          for (let point = start; point < end; point += 1) {
            const value = (liveData[point] - 128) / 128;
            sum += value * value;
          }
          amplitude = Math.max(
            0.035,
            Math.min(1, Math.sqrt(sum / Math.max(1, end - start)) * 3.2),
          );
        } else {
          amplitude = Math.max(
            0.035,
            Math.min(1, peaks[index] ?? 0),
          );
        }

        const barHeight = Math.max(3 * pixelRatio, amplitude * height * 0.84);
        context.fillStyle =
          live || index / count <= progress
            ? "rgba(167, 139, 250, 0.96)"
            : "rgba(117, 129, 158, 0.45)";
        context.beginPath();
        context.roundRect(
          (index / count) * width,
          center - barHeight / 2,
          barWidth,
          barHeight,
          Math.max(1, barWidth / 2),
        );
        context.fill();
      }

      if (live) frameId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [analyser, live, peaks, progress]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`h-28 w-full touch-pan-y sm:h-32 ${
        live ? "cursor-default" : "cursor-pointer"
      }`}
      onClick={(event) => {
        if (live) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (bounds.width > 0) {
          onSeek(
            Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
          );
        }
      }}
    />
  );
}

export function AudioStudio() {
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioAsset, setAudioAsset] = useState<AudioAsset | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [latestTranscription, setLatestTranscription] =
    useState<TranscriptionEntry | null>(null);
  const audioLoadSequenceRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const discardRecordingRef = useRef(false);
  const mountedRef = useRef(false);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (recorderStatus !== "recording") return;
    const intervalId = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) {
        setElapsedMs(elapsedRef.current + Date.now() - startedAt);
      }
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [recorderStatus]);

  useEffect(() => {
    if (!audioAsset) return;
    return () => URL.revokeObjectURL(audioAsset.url);
  }, [audioAsset]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = mediaRecorderRef.current;
      try {
        if (recorder && recorder.state !== "inactive") {
          recorder.onstop = null;
          recorder.stop();
        }
      } finally {
        microphoneStreamRef.current
          ?.getTracks()
          .forEach((track) => track.stop());
        const audioContext = audioContextRef.current;
        if (audioContext && audioContext.state !== "closed") {
          void audioContext.close();
        }
      }
    };
  }, []);

  const releaseMicrophone = useCallback(() => {
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    analyserRef.current = null;
    setAnalyser(null);
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close();
    }
  }, []);

  const loadAudio = useCallback(
    async (blob: Blob, name: string, source: AudioAsset["source"]) => {
      const requestId = ++audioLoadSequenceRef.current;
      const url = URL.createObjectURL(blob);
      setAudioAsset({
        url,
        blob,
        name,
        size: blob.size,
        mimeType: blob.type || "audio/unknown",
        source,
      });
      setWaveform([]);
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setError("");
      setNotice("");
      setLatestTranscription(null);
      setIsDecoding(true);

      try {
        const peaks = await extractWaveform(blob);
        if (requestId === audioLoadSequenceRef.current) setWaveform(peaks);
      } catch {
        if (requestId === audioLoadSequenceRef.current) {
          setNotice(
            "Audio is ready to preview, but this browser could not decode it for a waveform.",
          );
        }
      } finally {
        if (requestId === audioLoadSequenceRef.current) setIsDecoding(false);
      }
    },
    [],
  );

  const startRecording = async () => {
    if (isTranscribing) return;
    setError("");
    setNotice("");
    if (!window.isSecureContext) {
      setError(
        "Microphone recording requires a secure page. Open KasaSpeech over HTTPS or localhost.",
      );
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.MediaRecorder === "undefined" ||
      typeof window.MediaRecorder.isTypeSupported !== "function"
    ) {
      setError(
        "Microphone recording is not supported in this browser. Try a current version of Chrome, Edge, or Firefox over HTTPS.",
      );
      return;
    }
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/webm",
      "audio/ogg",
    ].find((candidate) => window.MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      setError(
        "This browser does not support a recording format that KasaSpeech can use. Try a current version of Chrome, Edge, or Firefox.",
      );
      return;
    }

    setRecorderStatus("requesting");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: { ideal: 1 },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
        });
      } catch (constraintError) {
        if (
          !(
            constraintError instanceof DOMException &&
            ["NotReadableError", "OverconstrainedError"].includes(
              constraintError.name,
            )
          )
        ) {
          throw constraintError;
        }

        setNotice("Retrying microphone access with the browser’s default settings…");
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setNotice("Microphone opened using the browser’s default settings.");
      }
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneStreamRef.current = stream;
      audioElementRef.current?.pause();
      chunksRef.current = [];
      discardRecordingRef.current = false;
      elapsedRef.current = 0;
      setElapsedMs(0);

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        const recorderError =
          "error" in event && event.error instanceof DOMException
            ? event.error
            : null;
        setError(
          recorderError
            ? errorMessage(recorderError)
            : "The browser could not continue recording. Try again.",
        );
        discardRecordingRef.current = true;
        setRecorderStatus("processing");
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } finally {
          releaseMicrophone();
        }
      };
      recorder.onstop = () => {
        releaseMicrophone();
        setRecorderStatus("idle");
        if (!discardRecordingRef.current) {
          const type = recorder.mimeType || mimeType || "audio/webm";
          const recording = new Blob(chunksRef.current, { type });
          if (recording.size > 0) {
            const extension = type.includes("ogg")
              ? "ogg"
              : type.includes("mp4")
                ? "m4a"
                : "webm";
            const name = `kasaspeech-recording-${new Date()
              .toISOString()
              .replaceAll(":", "-")}.${extension}`;
            void loadAudio(recording, name, "recording");
          } else {
            setError(
              "The recording was empty. Check your microphone and try again.",
            );
          }
        } else {
          discardRecordingRef.current = false;
          elapsedRef.current = 0;
          setElapsedMs(0);
        }
        chunksRef.current = [];
      };

      try {
        const context = new window.AudioContext();
        audioContextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const meter = context.createAnalyser();
        meter.fftSize = 2048;
        source.connect(meter);
        analyserRef.current = meter;
        setAnalyser(meter);
        await context.resume();
      } catch {
        const context = audioContextRef.current;
        audioContextRef.current = null;
        analyserRef.current = null;
        setAnalyser(null);
        if (context && context.state !== "closed") void context.close();
        setNotice(
          "Recording can continue, but the live waveform is unavailable in this browser.",
        );
      }

      recorder.start(250);
      startedAtRef.current = Date.now();
      setRecorderStatus("recording");
    } catch (caughtError) {
      releaseMicrophone();
      setRecorderStatus("idle");
      setError(errorMessage(caughtError));
    }
  };

  const pauseRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    elapsedRef.current += startedAtRef.current
      ? Date.now() - startedAtRef.current
      : 0;
    startedAtRef.current = null;
    setElapsedMs(elapsedRef.current);
    recorder.pause();
    setRecorderStatus("paused");
  };

  const resumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    startedAtRef.current = Date.now();
    recorder.resume();
    setRecorderStatus("recording");
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const startedAt = startedAtRef.current;
    if (startedAt !== null) {
      elapsedRef.current += Date.now() - startedAt;
      startedAtRef.current = null;
    }
    setElapsedMs(elapsedRef.current);
    setRecorderStatus("processing");
    recorder.stop();
  };

  const discardRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      discardRecordingRef.current = true;
      startedAtRef.current = null;
      setRecorderStatus("processing");
      recorder.stop();
      return;
    }
    releaseMicrophone();
    setRecorderStatus("idle");
    setElapsedMs(0);
    elapsedRef.current = 0;
  };

  const acceptFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (!supportsAudioFile(file)) {
      setError("Choose a WAV, MP3, M4A, FLAC, OGG, or WebM audio file.");
      return;
    }
    if (file.size === 0) {
      setError("That audio file is empty. Choose another file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Audio files must be 50 MB or smaller.");
      return;
    }
    if (
      recorderStatus === "requesting" ||
      recorderStatus === "recording" ||
      recorderStatus === "paused" ||
      recorderStatus === "processing" ||
      isTranscribing
    ) {
      setError(
        "Wait for the current recording to finish, or stop or discard it before loading another file.",
      );
      return;
    }
    await loadAudio(file, file.name, "upload");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void acceptFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  };

  const seek = (position: number) => {
    const player = audioElementRef.current;
    if (!player || !Number.isFinite(player.duration)) return;
    player.currentTime = position * player.duration;
    setCurrentTime(player.currentTime);
  };

  const togglePlayback = async () => {
    const player = audioElementRef.current;
    if (!player || !audioAsset) return;
    if (player.paused) {
      try {
        await player.play();
        setIsPlaying(true);
        setError("");
      } catch (caughtError) {
        setError(errorMessage(caughtError));
      }
    } else {
      player.pause();
      setIsPlaying(false);
    }
  };

  const stopPlayback = () => {
    const player = audioElementRef.current;
    if (!player) return;
    player.pause();
    player.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const replay = async () => {
    const player = audioElementRef.current;
    if (!player || !audioAsset) return;
    player.currentTime = 0;
    setCurrentTime(0);
    try {
      await player.play();
      setIsPlaying(true);
      setError("");
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    }
  };

  const clearAudio = () => {
    if (isTranscribing) return;
    audioLoadSequenceRef.current += 1;
    audioElementRef.current?.pause();
    setAudioAsset(null);
    setWaveform([]);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setNotice("");
    setError("");
  };

  const transcribeAudio = async () => {
    if (!audioAsset || isTranscribing) return;

    setError("");
    setNotice("");
    setLatestTranscription(null);
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append("audio", audioAsset.blob, audioAsset.name);

    try {
      const response = await fetch("/api/transcriptions", {
        method: "POST",
        body: formData,
      });

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        throw new Error("The ASR service returned an invalid response.");
      }

      if (typeof result !== "object" || result === null) {
        throw new Error("The ASR service returned an unexpected response.");
      }
      if (!response.ok) {
        const message =
          "error" in result && typeof result.error === "string"
            ? result.error
            : `Transcription failed with HTTP ${response.status}.`;
        throw new Error(message);
      }
      if (
        !("transcript" in result) ||
        typeof result.transcript !== "string" ||
        !("processingMs" in result) ||
        typeof result.processingMs !== "number"
      ) {
        throw new Error("The ASR service did not return a valid transcript.");
      }

      const entry: TranscriptionEntry = {
        id: crypto.randomUUID(),
        audio: audioAsset.blob,
        fileName: audioAsset.name,
        mimeType: audioAsset.mimeType,
        transcript: result.transcript,
        durationSeconds: duration,
        processingMs: result.processingMs,
        createdAt: new Date().toISOString(),
      };

      setLatestTranscription(entry);

      try {
        await saveTranscription(entry);
        setNotice("Transcription and audio saved to this browser’s history.");
      } catch {
        setNotice(
          "Transcription succeeded, but this browser could not save it to history. Check site storage space and permissions.",
        );
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Transcription failed. Check the endpoint configuration and try again.",
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const transferTranscript = (
    target: "translation" | "assistant" | "tts",
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    try {
      saveWorkspaceDraft(target, latestTranscription?.transcript ?? "");
    } catch {
      event.preventDefault();
      setError("Could not transfer the transcript to the selected workspace.");
    }
  };

  const displaySeconds =
    recorderStatus === "recording" || recorderStatus === "paused"
      ? elapsedMs / 1000
      : 0;
  const isRecording = recorderStatus === "recording";
  const isRecorderActive =
    recorderStatus === "recording" || recorderStatus === "paused";

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border border-primary/25 bg-primary/15 text-violet-100 hover:bg-primary/15">
              <Mic aria-hidden="true" />
              Audio workspace
            </Badge>
            <span className="text-xs text-muted-foreground">
              Your audio stays in this browser in this phase.
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Speech Studio
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Record speech or load an audio file, then review the original audio.
            Submit a clip to hosted ASR and keep its result in this browser.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-amber-300/25 bg-amber-300/10 text-amber-200"
        >
          Hosted ASR
        </Badge>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-100"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && !error && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-sky-300/20 bg-sky-300/[0.07] px-4 py-3 text-sm text-sky-100"
        >
          <AudioLines aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mic aria-hidden="true" className="size-4 text-primary" />
                  Microphone recorder
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Allow microphone access when your browser asks.
                </CardDescription>
              </div>
              {isRecording ? (
                <Badge className="gap-1.5 border border-rose-300/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/10">
                  <span className="size-1.5 animate-pulse rounded-full bg-rose-300" />
                  Recording
                </Badge>
              ) : recorderStatus === "requesting" ? (
                <Badge variant="outline">Requesting microphone</Badge>
              ) : recorderStatus === "paused" ? (
                <Badge
                  variant="outline"
                  className="border-amber-300/25 text-amber-200"
                >
                  Paused
                </Badge>
              ) : recorderStatus === "processing" ? (
                <Badge variant="outline">Saving recording</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-border/80 text-muted-foreground"
                >
                  Ready
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-background/45 px-4 py-5 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {isRecording
                    ? "Live microphone waveform"
                    : recorderStatus === "paused"
                      ? "Recording paused"
                      : "Input level"}
                </span>
                <span className="font-mono text-lg tabular-nums text-foreground">
                  {formatTime(displaySeconds)}
                </span>
              </div>
              <div className="relative flex h-28 items-center overflow-hidden rounded-xl bg-muted/40 px-2 sm:h-32">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border/80" />
                <Waveform
                  peaks={EMPTY_WAVEFORM}
                  analyser={analyser}
                  live={isRecording}
                  progress={0}
                  onSeek={() => undefined}
                />
                {!isRecording && recorderStatus !== "paused" && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10px] text-muted-foreground/70">
                    {recorderStatus === "processing"
                      ? "Finalizing your recording…"
                      : "Waveform responds to live microphone audio"}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {recorderStatus === "requesting" ? (
                  <Button
                    type="button"
                    disabled
                    className="h-10 gap-2 bg-violet-500 px-4 text-white"
                  >
                    <Mic aria-hidden="true" className="size-4" />
                    Waiting for permission…
                  </Button>
                ) : !isRecorderActive ? (
                  <Button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={recorderStatus === "processing" || isTranscribing}
                    className="h-10 gap-2 bg-violet-500 px-4 text-white hover:bg-violet-400"
                  >
                    <Mic aria-hidden="true" className="size-4" />
                    Start recording
                  </Button>
                ) : (
                  <>
                    {isRecording ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={pauseRecording}
                        className="h-10 gap-2"
                      >
                        <Pause aria-hidden="true" className="size-4" />
                        Pause
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={resumeRecording}
                        className="h-10 gap-2 bg-violet-500 px-4 text-white hover:bg-violet-400"
                      >
                        <Play aria-hidden="true" className="size-4" />
                        Resume
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopRecording}
                      className="h-10 gap-2"
                    >
                      <Square aria-hidden="true" className="size-3.5 fill-current" />
                      Stop & save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={discardRecording}
                      className="h-10 gap-2 text-muted-foreground hover:text-rose-200"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Discard
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
              className={`rounded-2xl border border-dashed px-5 py-5 text-center transition-colors sm:px-6 ${
                isDragging
                  ? "border-primary/70 bg-primary/[0.08]"
                  : "border-border/80 bg-background/25"
              }`}
            >
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Upload aria-hidden="true" className="size-[18px]" />
              </div>
              <p className="mt-3 text-sm font-medium">
                Drop an audio file here or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isTranscribing}
                  className="font-semibold text-violet-300 underline decoration-violet-300/40 underline-offset-4 hover:text-violet-200"
                >
                  browse files
                </button>
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                WAV, MP3, M4A, FLAC, OGG, or WebM · 50 MB maximum
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,.mp3,.m4a,.flac,.ogg,.webm,audio/*"
                onChange={handleFileChange}
                disabled={isTranscribing}
                className="sr-only"
                aria-label="Choose an audio file"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Headphones aria-hidden="true" className="size-4 text-sky-300" />
              Audio review
            </CardTitle>
            <CardDescription>
              Listen back and inspect the recording before transcription.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {audioAsset ? (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/45 p-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileAudio2 aria-hidden="true" className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {audioAsset.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {audioAsset.source === "recording"
                        ? "Microphone recording"
                        : "Local file"}
                      {" · "}
                      {formatFileSize(audioAsset.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={clearAudio}
                    disabled={isTranscribing}
                    aria-label="Remove selected audio"
                    title="Remove audio"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>

                <audio
                  ref={audioElementRef}
                  src={audioAsset.url}
                  preload="metadata"
                  className="hidden"
                  onLoadedMetadata={(event) => {
                    const audioDuration = event.currentTarget.duration;
                    if (Number.isFinite(audioDuration)) {
                      setDuration(audioDuration);
                      setCurrentTime(0);
                      event.currentTarget.volume = volume;
                      event.currentTarget.playbackRate = playbackRate;
                    }
                  }}
                  onTimeUpdate={(event) =>
                    setCurrentTime(event.currentTarget.currentTime)
                  }
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => {
                    if (audioAsset) {
                      setError(
                        "This browser cannot play the selected audio format. Try converting it to WAV, MP3, or WebM.",
                      );
                    }
                  }}
                />

                <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-4 sm:px-4">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{isDecoding ? "Building waveform…" : "Audio waveform"}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="mt-2">
                    <Waveform
                      peaks={waveform}
                      analyser={null}
                      live={false}
                      progress={duration > 0 ? currentTime / duration : 0}
                      onSeek={seek}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(currentTime, duration)}
                    onChange={(event) => {
                      const nextTime = Number(event.currentTarget.value);
                      if (audioElementRef.current) {
                        audioElementRef.current.currentTime = nextTime;
                      }
                      setCurrentTime(nextTime);
                    }}
                    disabled={!duration}
                    aria-label="Seek through audio"
                    className="mt-1 h-1.5 w-full cursor-pointer accent-violet-400 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void replay()}
                      disabled={!duration}
                      aria-label="Replay from the beginning"
                      title="Replay"
                    >
                      <RotateCcw aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={stopPlayback}
                      disabled={!duration}
                      aria-label="Stop playback"
                      title="Stop"
                    >
                      <Square aria-hidden="true" className="size-3 fill-current" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void togglePlayback()}
                      disabled={!duration}
                      className="size-10 rounded-full bg-violet-500 text-white hover:bg-violet-400"
                      aria-label={isPlaying ? "Pause audio" : "Play audio"}
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause aria-hidden="true" className="size-4" />
                      ) : (
                        <Play aria-hidden="true" className="ml-0.5 size-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor="playback-speed">
                      Playback speed
                    </label>
                    <select
                      id="playback-speed"
                      value={playbackRate}
                      onChange={(event) => {
                        const rate = Number(event.currentTarget.value);
                        setPlaybackRate(rate);
                        if (audioElementRef.current) {
                          audioElementRef.current.playbackRate = rate;
                        }
                      }}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <option value={0.75}>0.75×</option>
                      <option value={1}>1×</option>
                      <option value={1.25}>1.25×</option>
                      <option value={1.5}>1.5×</option>
                      <option value={2}>2×</option>
                    </select>
                    <Volume2
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <label className="sr-only" htmlFor="playback-volume">
                      Playback volume
                    </label>
                    <input
                      id="playback-volume"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(event) => {
                        const nextVolume = Number(event.currentTarget.value);
                        setVolume(nextVolume);
                        if (audioElementRef.current) {
                          audioElementRef.current.volume = nextVolume;
                        }
                      }}
                      className="w-16 cursor-pointer accent-violet-400 sm:w-20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                  <Button
                    type="button"
                    onClick={() => void transcribeAudio()}
                    disabled={isTranscribing}
                    className="h-8 gap-2 bg-violet-500 px-3 text-xs text-white hover:bg-violet-400"
                  >
                    {isTranscribing ? (
                      <span
                        aria-hidden="true"
                        className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      />
                    ) : (
                      <AudioLines aria-hidden="true" className="size-3.5" />
                    )}
                    {isTranscribing ? "Transcribing…" : "Transcribe audio"}
                  </Button>
                  <a
                    href={audioAsset.url}
                    download={audioAsset.name}
                    className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Download aria-hidden="true" className="size-3.5" />
                    Download original
                  </a>
                  <Badge
                    variant="outline"
                    className="h-8 border-border/80 text-muted-foreground"
                  >
                    {audioAsset.mimeType}
                  </Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Selecting Transcribe sends this audio to the KasaSpeech
                  Gradio Space. Successful audio and transcript are
                  stored in this browser only.
                </p>
              </>
            ) : (
              <div className="flex min-h-[310px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/30 px-5 py-9 text-center">
                <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  {isRecorderActive ? (
                    <Waves aria-hidden="true" className="size-5 text-primary" />
                  ) : (
                    <Headphones aria-hidden="true" className="size-5" />
                  )}
                </span>
                <h2 className="text-sm font-medium">
                  {isRecorderActive
                    ? "Your recording is in progress"
                    : "No audio selected"}
                </h2>
                <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
                  {isRecorderActive
                    ? "Stop and save the recording to replay, seek, adjust playback, or download it."
                    : "Record from your microphone or choose an audio file. You can listen before moving on."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {latestTranscription && (
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AudioLines aria-hidden="true" className="size-4 text-primary" />
              Latest transcription
            </CardTitle>
            <CardDescription>
              Actual KasaSpeech Space result ·{" "}
              {(latestTranscription.processingMs / 1000).toFixed(1)}s
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-background/45 p-4 text-sm leading-6">
              {latestTranscription.transcript || (
                <span className="italic text-muted-foreground">
                  The endpoint returned an empty transcript for this audio.
                </span>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/translate"
                onClick={(event) => transferTranscript("translation", event)}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                Translate transcript
              </Link>
              <Link
                href="/assistant"
                onClick={(event) => transferTranscript("assistant", event)}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                Ask assistant
              </Link>
              <Link
                href="/tts"
                onClick={(event) => transferTranscript("tts", event)}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                Speak transcript
              </Link>
              <Link
                href="/asr"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                View all transcriptions
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-sky-300/15 bg-sky-300/[0.045]">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200">
            <Check aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Audio storage is local to this browser
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Audio stays in the browser until you select Transcribe. That
              action sends the selected clip to the KasaSpeech Gradio Space;
              successful results are stored in this browser’s history.
            </p>
          </div>
          {recorderStatus === "idle" && !audioAsset && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check
                aria-hidden="true"
                className="size-3.5 text-emerald-300"
              />
              Ready when you are
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

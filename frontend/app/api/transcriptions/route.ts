
import { Client, handle_file } from "@gradio/client";

const SPACE_ID = "JOHANNES02/kasaspeech";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = new Set([
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

const REQUEST_WINDOW_MS = 60_000;
const REQUEST_LIMIT = 10;

type RequestWindow = {
  count: number;
  expiresAt: number;
};

const requestsByClient = new Map<string, RequestWindow>();

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim();

  const host = forwardedHost || request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hasExceededRateLimit(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedHops = forwardedFor?.split(",");

  const client =
    forwardedHops?.[forwardedHops.length - 1]?.trim() || "unknown";

  const now = Date.now();
  const current = requestsByClient.get(client);

  if (!current || current.expiresAt <= now) {
    requestsByClient.set(client, {
      count: 1,
      expiresAt: now + REQUEST_WINDOW_MS,
    });

    return false;
  }

  if (current.count >= REQUEST_LIMIT) return true;

  current.count += 1;
  return false;
}

export async function GET() {
  return jsonResponse({
    configured: true,
    provider: "huggingface-space",
  });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return jsonResponse(
      { error: "Cross-origin requests are not allowed." },
      403,
    );
  }

  if (hasExceededRateLimit(request)) {
    return jsonResponse(
      {
        error:
          "Too many transcription requests. Wait a minute and try again.",
      },
      429,
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") || 0,
  );

  if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
    return jsonResponse(
      { error: "Audio files must be 50 MB or smaller." },
      413,
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonResponse(
      { error: "Send an audio file using multipart form data." },
      400,
    );
  }

  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return jsonResponse(
      { error: "The audio file is missing." },
      400,
    );
  }

  if (audio.size === 0) {
    return jsonResponse(
      { error: "The selected audio file is empty." },
      400,
    );
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonResponse(
      { error: "Audio files must be 50 MB or smaller." },
      413,
    );
  }

  const contentType = audio.type
    .toLowerCase()
    .split(";", 1)[0]
    .trim();

  if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
    return jsonResponse(
      {
        error: "Use WAV, MP3, M4A, FLAC, OGG, or WebM audio.",
      },
      415,
    );
  }

  const startedAt = Date.now();

  try {
    // Connect to your public KasaSpeech Hugging Face Space.
    const client = await Client.connect(SPACE_ID);

    // Send the uploaded audio to the /transcribe API.
    const result = await client.predict<unknown[]>("/transcribe", [
      handle_file(audio),
    ]);

    const transcript = Array.isArray(result.data)
      ? result.data[0]
      : undefined;

    if (typeof transcript !== "string") {
      return jsonResponse(
        {
          error:
            "KasaSpeech returned an unexpected response. Please try again.",
        },
        502,
      );
    }

    return jsonResponse({
      transcript: transcript.trim(),
      processingMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("KasaSpeech transcription error:", error);

    return jsonResponse(
      {
        error:
          "Could not complete transcription. The KasaSpeech Space may be starting, busy, or temporarily unavailable. Please try again.",
      },
      502,
    );
  }
}

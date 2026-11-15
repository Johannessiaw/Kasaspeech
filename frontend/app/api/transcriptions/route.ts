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

function getEndpointUrl() {
  const endpoint = process.env.KASASPEECH_ASR_ENDPOINT_URL;
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

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
    configured: Boolean(
      getEndpointUrl() && process.env.HF_TOKEN?.trim(),
    ),
  });
}

export async function POST(request: Request) {
  const endpointUrl = getEndpointUrl();
  const token = process.env.HF_TOKEN?.trim();
  if (!endpointUrl || !token) {
    return jsonResponse(
      {
        error:
          "Hosted ASR is not configured. Set KASASPEECH_ASR_ENDPOINT_URL and HF_TOKEN as server-side Codespaces secrets, then restart the app.",
      },
      503,
    );
  }

  if (!hasSameOrigin(request)) {
    return jsonResponse({ error: "Cross-origin requests are not allowed." }, 403);
  }

  if (hasExceededRateLimit(request)) {
    return jsonResponse(
      { error: "Too many transcription requests. Wait a minute and try again." },
      429,
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) {
    return jsonResponse({ error: "Audio files must be 50 MB or smaller." }, 413);
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
    return jsonResponse({ error: "The audio file is missing." }, 400);
  }
  if (audio.size === 0) {
    return jsonResponse({ error: "The selected audio file is empty." }, 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonResponse({ error: "Audio files must be 50 MB or smaller." }, 413);
  }
  const contentType = audio.type.toLowerCase().split(";", 1)[0].trim();
  if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
    return jsonResponse(
      { error: "Use WAV, MP3, M4A, FLAC, OGG, or WebM audio." },
      415,
    );
  }

  const startedAt = Date.now();
  let response: Response;
  let responseText: string;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": audio.type || "application/octet-stream",
        Accept: "application/json",
      },
      body: Buffer.from(await audio.arrayBuffer()),
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
    responseText = await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return jsonResponse(
        { error: "The ASR endpoint timed out. Check that the endpoint is running and try again." },
        504,
      );
    }
    return jsonResponse(
      { error: "Could not reach the Hugging Face ASR endpoint. Check its URL and status." },
      502,
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return jsonResponse(
        { error: "The ASR endpoint rejected authentication. Verify the server-side HF_TOKEN." },
        502,
      );
    }
    return jsonResponse(
      {
        error: `The Hugging Face ASR endpoint returned HTTP ${response.status}. Check its status and audio input format.`,
      },
      502,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    return jsonResponse(
      { error: "The ASR endpoint returned a response that was not valid JSON." },
      502,
    );
  }

  const transcript =
    typeof payload === "object" &&
    payload !== null &&
    "text" in payload &&
    typeof payload.text === "string"
      ? payload.text.trim()
      : null;
  if (transcript === null) {
    return jsonResponse(
      { error: "The ASR endpoint response did not contain a transcript." },
      502,
    );
  }

  return jsonResponse({
    transcript,
    processingMs: Date.now() - startedAt,
  });
}

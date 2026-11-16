import { languages } from "@/lib/languages";

const maximumAudioBytes = 50 * 1024 * 1024;
const allowedTypes = new Set([
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

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const hosts = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host")?.split(",")[0].trim(),
    ].filter((host): host is string => Boolean(host));
    return hosts.includes(originHost);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  const endpoint = process.env.LINGUA_DETECTION_API_URL;
  if (!endpoint) {
    return Response.json(
      { error: "No language-detection provider is configured on the server." },
      { status: 503 },
    );
  }
  try {
    const url = new URL(endpoint);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return Response.json(
        { error: "The detection endpoint must be a valid HTTPS URL." },
        { status: 503 },
      );
    }
  } catch {
    return Response.json(
      { error: "The configured detection endpoint URL is invalid." },
      { status: 503 },
    );
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximumAudioBytes + 1024 * 1024) {
    return Response.json({ error: "Audio files must be 50 MB or smaller." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send an audio file using multipart form data." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > maximumAudioBytes) {
    return Response.json({ error: "A non-empty audio file up to 50 MB is required." }, { status: 400 });
  }
  const contentType = audio.type.toLowerCase().split(";", 1)[0].trim();
  if (!allowedTypes.has(contentType)) {
    return Response.json({ error: "Use WAV, MP3, M4A, FLAC, OGG, or WebM audio." }, { status: 415 });
  }

  try {
    const providerForm = new FormData();
    providerForm.append("audio", audio, audio.name || "recording");
    const headers = new Headers();
    if (process.env.LINGUA_DETECTION_API_KEY) {
      headers.set("Authorization", `Bearer ${process.env.LINGUA_DETECTION_API_KEY}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: providerForm,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      return Response.json(
        { error: `Language detection failed with HTTP ${response.status}.` },
        { status: 502 },
      );
    }

    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null) {
      return Response.json({ error: "The detection provider returned an invalid response." }, { status: 502 });
    }
    const body = result as Record<string, unknown>;
    const detected =
      typeof body.language === "string"
        ? body.language
        : typeof body.language_code === "string"
          ? body.language_code
          : typeof body.detected_language === "string"
            ? body.detected_language
            : "";
    const normalizedCode = detected.toLowerCase();
    const primaryCode = normalizedCode.split("-", 1)[0];
    const language = languages.find(
      (item) =>
        item.code.toLowerCase() === normalizedCode ||
        item.code.toLowerCase() === primaryCode ||
        item.name.toLowerCase() === normalizedCode ||
        item.nativeName.toLowerCase() === normalizedCode,
    );
    if (!language) {
      return Response.json(
        { error: "The detection provider returned a language not present in the current catalogue." },
        { status: 502 },
      );
    }
    const rawConfidence = body.confidence ?? body.score;
    const confidence =
      typeof rawConfidence === "number" &&
      Number.isFinite(rawConfidence) &&
      rawConfidence >= 0 &&
      rawConfidence <= 1
        ? rawConfidence
        : null;
    return Response.json(
      { language: language.code, confidence },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The language-detection provider timed out after 30 seconds."
        : "Could not reach the configured language-detection provider.";
    return Response.json({ error: message }, { status: 502 });
  }
}

import { languageName } from "@/lib/languages";

type Task = "translation" | "assistant" | "tts";
type ProviderFormat =
  | "openai"
  | "rest"
  | "huggingface-translation"
  | "huggingface-tts";
type ProviderConfig = {
  url?: string;
  key?: string;
  model?: string;
  format: ProviderFormat;
  responseField?: string;
};

const genericTts: ProviderConfig = {
  url: process.env.LINGUA_TTS_API_URL,
  key: process.env.LINGUA_TTS_API_KEY,
  model: process.env.LINGUA_TTS_MODEL,
  format: process.env.LINGUA_TTS_FORMAT === "rest" ? "rest" : "openai",
  responseField: process.env.LINGUA_TTS_RESPONSE_FIELD || "audio",
};

const providerEnvironment: Record<Exclude<Task, "tts">, ProviderConfig> = {
  translation: {
    url:
      process.env.LINGUA_TRANSLATION_API_URL ||
      process.env.KASASPEECH_TRANSLATION_ENDPOINT_URL,
    key:
      process.env.LINGUA_TRANSLATION_API_KEY ||
      (process.env.KASASPEECH_TRANSLATION_ENDPOINT_URL &&
      !process.env.LINGUA_TRANSLATION_API_URL
        ? process.env.HF_TOKEN
        : undefined),
    model:
      process.env.LINGUA_TRANSLATION_MODEL ||
      (process.env.KASASPEECH_TRANSLATION_ENDPOINT_URL
        ? "facebook/nllb-200-distilled-600M"
        : undefined),
    format: process.env.LINGUA_TRANSLATION_FORMAT === "rest"
      ? "rest"
      : process.env.LINGUA_TRANSLATION_FORMAT === "openai"
        ? "openai"
        : process.env.KASASPEECH_TRANSLATION_ENDPOINT_URL &&
            !process.env.LINGUA_TRANSLATION_API_URL
          ? "huggingface-translation"
          : "openai",
    responseField: process.env.LINGUA_TRANSLATION_RESPONSE_FIELD || "text",
  },
  assistant: {
    url: process.env.LINGUA_ASSISTANT_API_URL,
    key: process.env.LINGUA_ASSISTANT_API_KEY,
    model: process.env.LINGUA_ASSISTANT_MODEL,
    format: process.env.LINGUA_ASSISTANT_FORMAT === "rest" ? "rest" : "openai",
    responseField: process.env.LINGUA_ASSISTANT_RESPONSE_FIELD || "text",
  },
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

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

function providerFor(task: Task, sourceLanguage = "en"): ProviderConfig {
  if (task === "tts") {
    if (genericTts.url) return genericTts;
    if (sourceLanguage === "en" && process.env.KASASPEECH_TTS_EN_ENDPOINT_URL) {
      return {
        url: process.env.KASASPEECH_TTS_EN_ENDPOINT_URL,
        key: process.env.HF_TOKEN,
        model: "facebook/mms-tts-eng",
        format: "huggingface-tts",
      };
    }
    if (
      sourceLanguage === "tw" &&
      process.env.KASASPEECH_TTS_TW_ENDPOINT_URL
    ) {
      return {
        url: process.env.KASASPEECH_TTS_TW_ENDPOINT_URL,
        key: process.env.HF_TOKEN,
        model: "Lhue-Lhue/akan-tts-mms-vits",
        format: "huggingface-tts",
      };
    }
    return { ...genericTts, url: undefined, model: undefined };
  }
  return providerEnvironment[task];
}

function isValidEndpoint(endpoint?: string) {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (
      (url.protocol === "https:" || (localDevelopment && url.protocol === "http:")) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function configured(task: Task, sourceLanguage = "en") {
  const provider = providerFor(task, sourceLanguage);
  return Boolean(provider.model && isValidEndpoint(provider.url));
}

function detectionConfigured() {
  return isValidEndpoint(process.env.LINGUA_DETECTION_API_URL);
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
    return (current as Record<string, unknown>)[key];
  }, value);
}

function providerErrorMessage(value: unknown, secret?: string) {
  if (typeof value !== "string") return "The provider returned an error.";
  const safe = secret ? value.replaceAll(secret, "[redacted]") : value;
  return safe.slice(0, 400);
}

function makeRequest(
  task: Task,
  provider: ProviderConfig,
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  voice: string,
  signal: AbortSignal,
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (provider.key) headers.set("Authorization", `Bearer ${provider.key}`);

  if (provider.format === "huggingface-translation") {
    const languageCodes: Record<string, string> = { en: "eng_Latn", tw: "twi_Latn" };
    return fetch(provider.url!, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        inputs: text,
        parameters: {
          src_lang: languageCodes[sourceLanguage],
          tgt_lang: languageCodes[targetLanguage],
        },
      }),
      cache: "no-store",
      redirect: "error",
    });
  }

  if (provider.format === "huggingface-tts") {
    return fetch(provider.url!, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({ inputs: text }),
      cache: "no-store",
      redirect: "error",
    });
  }

  if (provider.format === "rest") {
    return fetch(provider.url!, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        task,
        model: provider.model,
        text,
        sourceLanguage,
        targetLanguage,
        voice,
      }),
      cache: "no-store",
      redirect: "error",
    });
  }

  if (task === "tts") {
    return fetch(provider.url!, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: provider.model,
        input: text,
        voice,
        response_format: "mp3",
      }),
      cache: "no-store",
      redirect: "error",
    });
  }

  const messages =
    task === "translation"
      ? [
          {
            role: "system",
            content: `Translate the user's text from ${languageName(sourceLanguage)} (${sourceLanguage}) into ${languageName(targetLanguage)} (${targetLanguage}). Return only the translation; preserve meaning and tone.`,
          },
          { role: "user", content: text },
        ]
      : [
          {
            role: "system",
            content:
              "You are a helpful multilingual language assistant. Answer accurately and clearly. Do not claim to have performed audio or other work you did not receive.",
          },
          { role: "user", content: text },
        ];

  return fetch(provider.url!, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({ model: provider.model, messages }),
    cache: "no-store",
    redirect: "error",
  });
}

export async function GET() {
  const translation = providerFor("translation");
  const assistant = providerFor("assistant");
  const ttsEnglish = providerFor("tts", "en");
  const ttsTwi = providerFor("tts", "tw");
  const genericTtsConfigured = Boolean(
    genericTts.model && isValidEndpoint(genericTts.url),
  );
  return json({
    providers: {
      translation: {
        configured: configured("translation"),
        model: configured("translation") ? translation.model : null,
        hasApiKey: configured("translation") && Boolean(translation.key),
        supportedPairs:
          translation.format === "huggingface-translation"
            ? [["en", "tw"], ["tw", "en"]]
            : null,
      },
      assistant: {
        configured: configured("assistant"),
        model: configured("assistant") ? assistant.model : null,
        hasApiKey: configured("assistant") && Boolean(assistant.key),
      },
      tts: {
        configured:
          genericTtsConfigured ||
          configured("tts", "en") ||
          configured("tts", "tw"),
        model: genericTtsConfigured
          ? genericTts.model
          : configured("tts", "en")
            ? ttsEnglish.model
            : configured("tts", "tw")
              ? ttsTwi.model
              : null,
        hasApiKey:
          (genericTtsConfigured && Boolean(genericTts.key)) ||
          (!genericTtsConfigured &&
            ((configured("tts", "en") && Boolean(ttsEnglish.key)) ||
              (configured("tts", "tw") && Boolean(ttsTwi.key)))),
        supportedLanguages: genericTtsConfigured
          ? ["*"]
          : [
              ...(configured("tts", "en") ? ["en"] : []),
              ...(configured("tts", "tw") ? ["tw"] : []),
            ],
      },
    },
    detectionConfigured: detectionConfigured(),
    detectionHasApiKey: Boolean(process.env.LINGUA_DETECTION_API_KEY),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Cross-origin requests are not allowed." }, 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Send a valid JSON request." }, 400);
  }

  if (typeof input !== "object" || input === null) {
    return json({ error: "The request is invalid." }, 400);
  }

  const values = input as Record<string, unknown>;
  const task = values.task;
  const isTest = task === "test";
  if (task === "test") {
    const testTask = values.provider;
    if (testTask !== "translation" && testTask !== "assistant" && testTask !== "tts") {
      return json({ error: "Select a supported provider to test." }, 400);
    }
    const testSourceLanguage =
      testTask === "tts" &&
      !process.env.LINGUA_TTS_API_URL &&
      !configured("tts", "en")
        ? "tw"
        : "en";
    if (!configured(testTask, testSourceLanguage)) {
      return json({ error: "This provider is not configured on the server." }, 409);
    }
    values.task = testTask;
    values.text =
      testTask === "translation"
        ? "Hello."
        : testTask === "assistant"
          ? "Reply with: connection test successful."
          : "Connection test.";
    values.sourceLanguage = testSourceLanguage;
    values.targetLanguage = configured("translation") &&
      providerFor("translation").format === "huggingface-translation"
      ? "tw"
      : "fr";
  } else if (task !== "translation" && task !== "assistant" && task !== "tts") {
    return json({ error: "Select a supported language task." }, 400);
  }

  const selectedTask = values.task as Task;
  const text = typeof values.text === "string" ? values.text.trim() : "";
  const sourceLanguage =
    typeof values.sourceLanguage === "string" ? values.sourceLanguage : "auto";
  const targetLanguage =
    typeof values.targetLanguage === "string" ? values.targetLanguage : "";
  const voice = typeof values.voice === "string" ? values.voice : "alloy";

  if (!text || text.length > 10_000) {
    return json({ error: "Enter text between 1 and 10,000 characters." }, 400);
  }
  if (selectedTask === "translation" && !targetLanguage) {
    return json({ error: "Choose a destination language." }, 400);
  }
  const provider = providerFor(selectedTask, sourceLanguage);
  if (!configured(selectedTask, sourceLanguage)) {
    return json(
      {
        error:
          selectedTask === "tts" && !genericTts.url
            ? `No speech provider is configured for ${languageName(sourceLanguage)}. The KasaSpeech hosted models support English and Twi only.`
            : `No ${selectedTask} provider is configured on the server.`,
      },
      503,
    );
  }
  if (
    selectedTask === "translation" &&
    provider.format === "huggingface-translation" &&
    !(["en", "tw"].includes(sourceLanguage) && ["en", "tw"].includes(targetLanguage))
  ) {
    return json(
      { error: "The configured KasaSpeech translation endpoint supports English ↔ Twi only." },
      422,
    );
  }
  if (
    selectedTask === "translation" &&
    (!/^[\w-]{2,35}$/.test(sourceLanguage) ||
      !/^[\w-]{2,35}$/.test(targetLanguage) ||
      sourceLanguage === "auto")
  ) {
    return json({ error: "Choose valid source and destination language codes." }, 400);
  }

  const startedAt = Date.now();
  const timeout = AbortSignal.timeout(30_000);

  try {
    const response = await makeRequest(
      selectedTask,
      provider,
      text,
      sourceLanguage,
      targetLanguage,
      voice,
      timeout,
    );

    if (!response.ok) {
      const body = await response.text();
      return json(
        {
          error: providerErrorMessage(
            body || `Provider request failed with HTTP ${response.status}.`,
            provider.key,
          ),
        },
        502,
      );
    }

    if (selectedTask === "tts") {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().startsWith("audio/")) {
        return json(
          { error: "The TTS provider did not return an audio content type." },
          502,
        );
      }
      const audio = await response.arrayBuffer();
      if (audio.byteLength === 0 || audio.byteLength > 30 * 1024 * 1024) {
        return json({ error: "The provider returned empty or oversized audio." }, 502);
      }
      if (isTest) {
        return json({
          connected: true,
          model: provider.model,
          responseMs: Date.now() - startedAt,
        });
      }
      return new Response(audio, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "X-Processing-Ms": String(Date.now() - startedAt),
        },
      });
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      return json({ error: "The provider returned invalid JSON." }, 502);
    }
    const output =
      provider.format === "openai"
        ? getPath(result, "choices.0.message.content")
        : provider.format === "huggingface-translation"
          ? getPath(result, "0.translation_text") ??
            getPath(result, "translation_text")
          : getPath(result, provider.responseField ?? "text");
    if (typeof output !== "string" || !output.trim()) {
      return json(
        { error: "The provider response did not contain the configured text result." },
        502,
      );
    }
    if (isTest) {
      return json({
        connected: true,
        model: provider.model,
        responseMs: Date.now() - startedAt,
      });
    }
    return json({ result: output.trim(), processingMs: Date.now() - startedAt });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The provider request timed out after 30 seconds."
        : "Could not reach the configured provider. Check its URL and server logs.";
    return json({ error: message }, 502);
  }
}

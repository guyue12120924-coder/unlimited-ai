const MELO_MODEL = "@cf/myshell-ai/melotts";
const GROK_MODEL = "xai/grok-tts";
const MAX_TEXT_LENGTH = 700;
const LANGS = new Set(["zh", "en", "ja", "ko", "es", "fr"]);
const ENGINES = new Set(["auto", "grok", "melo"]);
const GROK_VOICES = new Set(["eve", "ara", "rex", "sal", "leo"]);
const DEFAULT_GROK_VOICE = "eve";

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function audioResponse(body, contentType = "audio/mpeg", meta = {}) {
  const headers = {
    "Content-Type": contentType || "audio/mpeg",
    "Cache-Control": "no-store",
    "X-TTS-Provider": "Cloudflare AI",
    "X-TTS-Engine": String(meta.engine || "unknown")
  };
  if (meta.model) headers["X-TTS-Model"] = String(meta.model);
  if (meta.voice) headers["X-TTS-Voice"] = String(meta.voice);
  return new Response(body, { status: 200, headers });
}

function decodeBase64(value) {
  const binary = atob(String(value || "").replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function normalizeAudio(result) {
  if (!result) return null;
  if (result instanceof Response) {
    return {
      body: result.body,
      contentType: result.headers.get("content-type") || "audio/mpeg",
      status: result.status
    };
  }
  if (result instanceof ReadableStream) return { body: result, contentType: "audio/mpeg", status: 200 };
  if (result instanceof ArrayBuffer) return { body: result, contentType: "audio/mpeg", status: 200 };
  if (ArrayBuffer.isView(result)) return { body: result, contentType: "audio/mpeg", status: 200 };

  const candidate = result.audio || result.data || result.response || result.result?.audio || result.result;
  if (candidate instanceof ReadableStream || candidate instanceof ArrayBuffer || ArrayBuffer.isView(candidate)) {
    return { body: candidate, contentType: result.contentType || result.content_type || "audio/mpeg", status: 200 };
  }
  if (typeof candidate === "string" && candidate.length > 64 && !/^https?:\/\//i.test(candidate)) {
    try {
      return { body: decodeBase64(candidate), contentType: result.contentType || result.content_type || "audio/mpeg", status: 200 };
    } catch {}
  }
  if (typeof result === "string" && result.length > 64 && !/^https?:\/\//i.test(result)) {
    try { return { body: decodeBase64(result), contentType: "audio/mpeg", status: 200 }; } catch {}
  }
  return null;
}

async function runMelo(env, text, lang) {
  let result;
  try {
    result = await env.AI.run(MELO_MODEL, { prompt: text, lang }, { returnRawResponse: true });
  } catch {
    result = await env.AI.run(MELO_MODEL, { prompt: text, lang });
  }
  const normalized = normalizeAudio(result);
  if (!normalized || (normalized.status && normalized.status >= 400)) {
    throw new Error("MeloTTS returned an unexpected response");
  }
  return { ...normalized, engine: "melo", model: MELO_MODEL };
}

async function runGrok(env, text, lang, voice) {
  const language = lang === "zh" ? "zh" : lang;
  const result = await env.AI.run(GROK_MODEL, {
    text,
    language,
    voice_id: voice,
    text_normalization: true,
    output_format: {
      codec: "mp3",
      sample_rate: 24000,
      bit_rate: 128000
    }
  });

  const normalized = normalizeAudio(result);
  if (normalized && (!normalized.status || normalized.status < 400)) {
    return { ...normalized, engine: "grok", model: GROK_MODEL, voice };
  }

  const audioUrl = result?.audio || result?.result?.audio;
  if (typeof audioUrl !== "string" || !/^https:\/\//i.test(audioUrl)) {
    throw new Error("Grok TTS did not return an audio URL");
  }
  const audio = await fetch(audioUrl, { redirect: "follow" });
  if (!audio.ok || !audio.body) throw new Error(`Grok audio fetch failed (${audio.status})`);
  return {
    body: audio.body,
    contentType: audio.headers.get("content-type") || "audio/mpeg",
    status: audio.status,
    engine: "grok",
    model: GROK_MODEL,
    voice
  };
}

export async function handleCompanionTts(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ error: "Workers AI binding is not available", code: "AI_BINDING_MISSING" }, 503);
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: "Bad JSON" }, 400); }

  const text = String(payload?.text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) return json({ error: "Text is required" }, 400);
  const requestedLang = String(payload?.lang || "zh").toLowerCase();
  const lang = LANGS.has(requestedLang) ? requestedLang : "zh";
  const requestedEngine = String(payload?.engine || "auto").toLowerCase();
  const engine = ENGINES.has(requestedEngine) ? requestedEngine : "auto";
  const requestedVoice = String(payload?.voice_id || DEFAULT_GROK_VOICE).toLowerCase();
  const voice = GROK_VOICES.has(requestedVoice) ? requestedVoice : DEFAULT_GROK_VOICE;

  try {
    let audio;
    if (engine === "melo") {
      audio = await runMelo(env, text, lang);
    } else if (engine === "grok") {
      try {
        audio = await runGrok(env, text, lang, voice);
      } catch (grokError) {
        audio = await runMelo(env, text, lang);
        audio.fallbackFrom = grokError?.message || "Grok TTS failed";
      }
    } else {
      try {
        audio = await runGrok(env, text, lang, voice);
      } catch {
        audio = await runMelo(env, text, lang);
      }
    }

    return audioResponse(audio.body, audio.contentType, audio);
  } catch (error) {
    return json({
      error: error?.message || "Neural TTS failed",
      code: "TTS_GENERATION_FAILED"
    }, 502);
  }
}

export const companionTtsInfo = {
  models: { grok: GROK_MODEL, melo: MELO_MODEL },
  voices: [...GROK_VOICES],
  defaultVoice: DEFAULT_GROK_VOICE,
  maxTextLength: MAX_TEXT_LENGTH,
  languages: [...LANGS]
};
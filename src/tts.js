const TTS_MODEL = "@cf/myshell-ai/melotts";
const MAX_TEXT_LENGTH = 700;
const LANGS = new Set(["zh", "en", "ja", "ko", "es", "fr"]);

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function audioResponse(body, contentType = "audio/mpeg") {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType || "audio/mpeg",
      "Cache-Control": "no-store",
      "X-TTS-Provider": "Cloudflare Workers AI",
      "X-TTS-Model": TTS_MODEL
    }
  });
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

  const candidate = result.audio || result.data || result.response || result.result;
  if (candidate instanceof ReadableStream || candidate instanceof ArrayBuffer || ArrayBuffer.isView(candidate)) {
    return { body: candidate, contentType: result.contentType || result.content_type || "audio/mpeg", status: 200 };
  }
  if (typeof candidate === "string" && candidate.length > 64) {
    try {
      return { body: decodeBase64(candidate), contentType: result.contentType || result.content_type || "audio/mpeg", status: 200 };
    } catch {}
  }
  if (typeof result === "string" && result.length > 64) {
    try { return { body: decodeBase64(result), contentType: "audio/mpeg", status: 200 }; } catch {}
  }
  return null;
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

  try {
    let result;
    try {
      result = await env.AI.run(TTS_MODEL, { prompt: text, lang }, { returnRawResponse: true });
    } catch {
      result = await env.AI.run(TTS_MODEL, { prompt: text, lang });
    }

    const normalized = normalizeAudio(result);
    if (!normalized) {
      return json({ error: "Unexpected TTS response format", code: "TTS_BAD_RESPONSE" }, 502);
    }
    if (normalized.status && normalized.status >= 400) {
      return json({ error: `Workers AI TTS returned HTTP ${normalized.status}`, code: "TTS_UPSTREAM_ERROR" }, 502);
    }
    return audioResponse(normalized.body, normalized.contentType);
  } catch (error) {
    return json({
      error: error?.message || "Neural TTS failed",
      code: "TTS_GENERATION_FAILED"
    }, 502);
  }
}

export const companionTtsInfo = {
  model: TTS_MODEL,
  maxTextLength: MAX_TEXT_LENGTH,
  languages: [...LANGS]
};

import worker from "./worker.js";
import { handleCompanionTts } from "./tts.js";
import { handleCompanionStt } from "./stt.js";

const REVISION = "2026-08-20-v16.0-call-voice-stability";
const VOICE_RATE_WINDOW_MS = 60000;
const VOICE_RATE_BUCKETS = new Map();

function sameSiteRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) return origin === url.origin;
  const site = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  return !site || site === "same-origin" || site === "same-site" || site === "none";
}

function forbidden() {
  return new Response(JSON.stringify({ error: "Cross-site voice request blocked" }), {
    status: 403,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function clientKey(request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function consumeVoiceRate(request, route, limit) {
  const now = Date.now();
  const key = `${route}:${clientKey(request)}`;
  const current = VOICE_RATE_BUCKETS.get(key);
  if (!current || now - current.startedAt >= VOICE_RATE_WINDOW_MS) {
    VOICE_RATE_BUCKETS.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfter: 0 };
  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((VOICE_RATE_WINDOW_MS - (now - current.startedAt)) / 1000))
  };
}

function rateLimited(retryAfter) {
  return new Response(JSON.stringify({
    error: "Too many voice requests. Please wait a moment and try again.",
    code: "VOICE_RATE_LIMITED"
  }), {
    status: 429,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Scope": "worker-isolate"
    }
  });
}

function statusResponse(env) {
  return new Response(JSON.stringify({
    available: Boolean(env.AI && typeof env.AI.run === "function"),
    provider: "Cloudflare AI",
    ttsEngines: [
      { id: "grok", model: "xai/grok-tts", voices: ["ara", "eve", "sal", "rex", "leo"] },
      { id: "melo", model: "@cf/myshell-ai/melotts", voices: [] }
    ],
    sttModel: "@cf/openai/whisper-large-v3-turbo",
    revision: REVISION
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isTts = request.method === "POST" && url.pathname === "/api/companion/tts";
    const isStt = request.method === "POST" && url.pathname === "/api/companion/stt";
    const isVoicePost = isTts || isStt;

    if (isVoicePost && !sameSiteRequest(request)) return forbidden();
    if (isVoicePost) {
      const rate = consumeVoiceRate(request, isTts ? "tts" : "stt", isTts ? 30 : 12);
      if (!rate.allowed) return rateLimited(rate.retryAfter);
    }

    if (isTts) return handleCompanionTts(request, env);
    if (isStt) return handleCompanionStt(request, env);

    if (
      request.method === "GET"
      && (url.pathname === "/api/companion/tts/status" || url.pathname === "/api/companion/stt/status")
    ) {
      return statusResponse(env);
    }

    return worker.fetch(request, env, ctx);
  }
};
import worker from "./worker.js";
import { handleCompanionTts } from "./tts.js";
import { handleCompanionStt } from "./stt.js";

const REVISION = "2026-08-20-v16.2-ai-gateway";
// Compatibility marker for the V16.0 stability contract: 2026-08-20-v16.0-call-voice-stability
const RATE_WINDOW_MS = 60000;
const RATE_BUCKETS = new Map();

const JSON_POST_ROUTES = new Set([
  "/api/chat",
  "/api/memory/extract",
  "/api/continuity/review",
  "/api/companion/tts"
]);

const PROTECTED_POST_ROUTES = new Set([
  ...JSON_POST_ROUTES,
  "/api/companion/stt"
]);

function sameSiteRequest(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) return origin === url.origin;

  const site = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (site) return site === "same-origin" || site === "same-site" || site === "none";

  // Public browser clients send Origin and/or Fetch Metadata on these POST requests.
  // Requests with neither signal are treated as non-browser API calls and rejected.
  return false;
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function forbidden() {
  return json({
    error: "This AI endpoint only accepts same-site browser requests.",
    code: "AI_GATEWAY_FORBIDDEN"
  }, 403);
}

function badContentType() {
  return json({
    error: "This endpoint requires application/json.",
    code: "BAD_CONTENT_TYPE"
  }, 415);
}

function clientKey(request) {
  return request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function consumeApiRate(request, route, limit) {
  const now = Date.now();
  const key = `${route}:${clientKey(request)}`;
  const current = RATE_BUCKETS.get(key);

  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    RATE_BUCKETS.set(key, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
    if (current.count > limit) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.startedAt)) / 1000))
      };
    }
  }

  if (RATE_BUCKETS.size > 1000) {
    for (const [bucketKey, value] of RATE_BUCKETS) {
      if (now - value.startedAt > RATE_WINDOW_MS * 2) RATE_BUCKETS.delete(bucketKey);
    }
  }
  return { allowed: true, retryAfter: 0 };
}

function routeLimit(pathname) {
  if (pathname === "/api/chat") return { route: "chat", limit: 30 };
  if (pathname === "/api/memory/extract" || pathname === "/api/continuity/review") {
    return { route: "analysis", limit: 14 };
  }
  if (pathname === "/api/companion/tts") return { route: "tts", limit: 30 };
  if (pathname === "/api/companion/stt") return { route: "stt", limit: 12 };
  return { route: "ai", limit: 20 };
}

function rateLimited(retryAfter) {
  return json({
    error: "Too many AI requests. Please wait a moment and try again.",
    code: "AI_GATEWAY_RATE_LIMITED"
  }, 429, {
    "Retry-After": String(retryAfter),
    "X-RateLimit-Scope": "gateway-worker-isolate"
  });
}

function validateJsonContentType(request, pathname) {
  if (!JSON_POST_ROUTES.has(pathname)) return true;
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  return contentType.startsWith("application/json");
}

function statusResponse(env) {
  return json({
    available: Boolean(env.AI && typeof env.AI.run === "function"),
    provider: "Cloudflare AI",
    ttsEngines: [
      { id: "grok", model: "xai/grok-tts", voices: ["ara", "eve", "sal", "rex", "leo"] },
      { id: "melo", model: "@cf/myshell-ai/melotts", voices: [] }
    ],
    sttModel: "@cf/openai/whisper-large-v3-turbo",
    gateway: {
      sameSiteRequired: true,
      jsonContentTypeRequired: true,
      rateWindowMs: RATE_WINDOW_MS
    },
    revision: REVISION
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isProtectedPost = request.method === "POST" && PROTECTED_POST_ROUTES.has(pathname);

    if (isProtectedPost) {
      if (!sameSiteRequest(request)) return forbidden();
      if (!validateJsonContentType(request, pathname)) return badContentType();

      const { route, limit } = routeLimit(pathname);
      const rate = consumeApiRate(request, route, limit);
      if (!rate.allowed) return rateLimited(rate.retryAfter);
    }

    if (request.method === "POST" && pathname === "/api/companion/tts") {
      return handleCompanionTts(request, env);
    }

    if (request.method === "POST" && pathname === "/api/companion/stt") {
      return handleCompanionStt(request, env);
    }

    if (
      request.method === "GET"
      && (pathname === "/api/companion/tts/status" || pathname === "/api/companion/stt/status")
    ) {
      return statusResponse(env);
    }

    return worker.fetch(request, env, ctx);
  }
};
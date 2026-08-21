import worker from "./worker.js";
import { handleCompanionTts } from "./tts.js";
import { handleCompanionStt } from "./stt.js";

const REVISION = "2026-08-21-v16.5-ai-gateway-runtime";
// Compatibility marker for the V16.2 gateway rollout: 2026-08-20-v16.2-ai-gateway
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

  return false;
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value, null, 2), {
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

async function assetMarkerStatus(request, env, pathname, expectedMarkers, forbiddenMarkers = {}) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return { available: false, current: false, reason: "ASSETS binding unavailable" };
  }

  const url = new URL(pathname, request.url);
  url.searchParams.set("__diag", REVISION);
  try {
    const response = await env.ASSETS.fetch(new Request(url.toString(), {
      headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
    }));
    const body = await response.text();
    const markers = Object.fromEntries(
      Object.entries(expectedMarkers).map(([name, marker]) => [name, body.includes(marker)])
    );
    const forbidden = Object.fromEntries(
      Object.entries(forbiddenMarkers).map(([name, marker]) => [name, !body.includes(marker)])
    );
    return {
      path: pathname,
      available: response.ok,
      current: response.ok
        && Object.values(markers).every(Boolean)
        && Object.values(forbidden).every(Boolean),
      status: response.status,
      markers,
      forbidden
    };
  } catch (error) {
    return { path: pathname, available: false, current: false, error: error?.message || String(error) };
  }
}

function historyLifecycleStatus(request, env) {
  return assetMarkerStatus(request, env, "/history-lifecycle-v16.js", {
    revision: "2026-08-21-v16.5-history-ui",
    persistencePreference: "cfw_history_persist_v16",
    storageCoreOwnership: "Storage routing itself is owned",
    storageCoreApi: "core.setPersistence"
  }, {
    noStoragePrototypeSetPatch: "Storage.prototype.setItem =",
    noStoragePrototypeGetPatch: "Storage.prototype.getItem =",
    noStoragePrototypeRemovePatch: "Storage.prototype.removeItem ="
  });
}

function storageCoreStatus(request, env) {
  return assetMarkerStatus(request, env, "/storage-core-v163.js", {
    revision: "2026-08-20-v16.3-storage-core",
    singleGateway: "Object.defineProperties(Storage.prototype",
    dataNormalization: "window.UnlimitedData",
    storageErrors: "uai:storage-error"
  });
}

function chatContextCoreStatus(request, env) {
  return assetMarkerStatus(request, env, "/chat-context-core-v163.js", {
    revision: "2026-08-21-v16.4-chat-context-core",
    canonicalCreativeBuilder: "UnlimitedContext?.buildContext",
    creativeContext: "registerNovelEnricher(\"creative-context\"",
    storyMemory: "registerNovelEnricher(\"story-memory\"",
    continuity: "registerNovelEnricher(\"continuity\"",
    singleFetch: "window.fetch = transport.fetch"
  });
}

function appCoreStatus(request, env) {
  return assetMarkerStatus(request, env, "/app.js", {
    requestScopedSession: "const requestSessionId = currentSessionId",
    requestScopedMessages: "const requestMessages = requestSession.messages",
    sseBuffer: "let buffer = \"\"",
    streamDecoder: "decoder.decode(value, { stream: true })",
    abortOwnership: "currentAbortController === controller",
    partialPersistence: "requestMessages.push({ role: \"assistant\", content: full })"
  });
}

function observerRuntimeStatus(request, env) {
  return assetMarkerStatus(request, env, "/v3-runtime.js", {
    revision: "2026-08-21-v16.5-observer-scheduler",
    explicitScheduler: "function createObserver(callback)",
    globalObserverDiagnostic: "globalObserverUntouched",
    schedulerApi: "schedule,"
  }, {
    noGlobalObserverReplacement: "window.MutationObserver ="
  });
}

async function bridgeNetworkCleanupStatus(request, env) {
  const paths = ["/context-bridge.js", "/memory-bridge.js", "/continuity-bridge.js"];
  const results = await Promise.all(paths.map((pathname) => assetMarkerStatus(
    request,
    env,
    pathname,
    {},
    { legacyFetchWrapperRemoved: "window.fetch =" }
  )));
  return {
    current: results.every((item) => item.current),
    files: results
  };
}

async function diagnosticsResponse(request, env, ctx) {
  const inner = await worker.fetch(request, env, ctx);
  let data;
  try { data = await inner.clone().json(); }
  catch { return inner; }

  const [historyLifecycle, storageCore, chatContextCore, appCore, observerRuntime, bridgeNetworkCleanup] = await Promise.all([
    historyLifecycleStatus(request, env),
    storageCoreStatus(request, env),
    chatContextCoreStatus(request, env),
    appCoreStatus(request, env),
    observerRuntimeStatus(request, env),
    bridgeNetworkCleanupStatus(request, env)
  ]);
  const frontendCurrent = Boolean(
    data?.frontendCurrent
    && historyLifecycle.current
    && storageCore.current
    && chatContextCore.current
    && appCore.current
    && observerRuntime.current
    && bridgeNetworkCleanup.current
  );
  return json({
    ...data,
    frontendCurrent,
    realWorkerEntry: "src/worker-voice.js",
    gateway: {
      revision: REVISION,
      sameSiteRequired: true,
      rejectsMissingBrowserMetadata: true,
      jsonContentTypeRequired: true,
      rateWindowMs: RATE_WINDOW_MS,
      protectedPostRoutes: [...PROTECTED_POST_ROUTES]
    },
    runtimeCore: {
      revision: "2026-08-21-v16.5-runtime-cleanup",
      singleStorageGateway: storageCore.current,
      historyUsesStorageCoreOnly: historyLifecycle.current,
      singleChatFetchEntry: chatContextCore.current,
      globalMutationObserverUntouched: observerRuntime.current,
      explicitObserverScheduler: observerRuntime.current,
      coreRequestScopedSessions: appCore.current,
      coreSseParsing: appCore.current,
      legacyBridgeFetchWrappersRemoved: bridgeNetworkCleanup.current,
      registeredNovelContexts: ["creative-context", "story-memory", "continuity"]
    },
    storageCore,
    historyLifecycle,
    observerRuntime,
    chatContextCore,
    appCore,
    bridgeNetworkCleanup,
    conclusion: frontendCurrent
      ? "V16.5 runtime cleanup is current: Storage Core is the only storage gateway, MutationObserver remains native, and V16.4 chat/runtime protections remain intact."
      : "The deployment is missing one or more V16.5/V16.4/V16.3/V16.2 stability components; redeploy the current main branch."
  }, inner.status);
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

    if (request.method === "GET" && pathname === "/api/diagnostics") {
      return diagnosticsResponse(request, env, ctx);
    }

    return worker.fetch(request, env, ctx);
  }
};

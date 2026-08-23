import worker from "./worker.js";
import { handleCompanionTts } from "./tts.js";
import { handleCompanionStt } from "./stt.js";

const REVISION = "2026-08-23-v17.22-companion-diagnostics-gateway";
const FRONTEND_REVISION = "2026-08-23-v17.21-voice-experience-polish";
const DIAGNOSTICS_REVISION = "2026-08-23-v17.22-final-cleanup-diagnostics";
// Compatibility markers retained for older deployment contracts.
// 2026-08-21-v17.0-workspace-gateway
// 2026-08-21-v16.6-event-runtime-gateway
// 2026-08-21-v16.5-ai-gateway-runtime
// 2026-08-20-v16.2-ai-gateway
// 2026-08-20-v16.0-call-voice-stability

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
  return json({ error: "This AI endpoint only accepts same-site browser requests.", code: "AI_GATEWAY_FORBIDDEN" }, 403);
}

function badContentType() {
  return json({ error: "This endpoint requires application/json.", code: "BAD_CONTENT_TYPE" }, 415);
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
  if (pathname === "/api/memory/extract" || pathname === "/api/continuity/review") return { route: "analysis", limit: 14 };
  if (pathname === "/api/companion/tts") return { route: "tts", limit: 30 };
  if (pathname === "/api/companion/stt") return { route: "stt", limit: 12 };
  return { route: "ai", limit: 20 };
}

function rateLimited(retryAfter) {
  return json({ error: "Too many AI requests. Please wait a moment and try again.", code: "AI_GATEWAY_RATE_LIMITED" }, 429, {
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
    defaultVoice: "eve",
    defaultVoicePersona: "sweet",
    sttModel: "@cf/openai/whisper-large-v3-turbo",
    frontendRevision: FRONTEND_REVISION,
    diagnosticsRevision: DIAGNOSTICS_REVISION,
    gateway: { sameSiteRequired: true, jsonContentTypeRequired: true, rateWindowMs: RATE_WINDOW_MS },
    revision: REVISION
  });
}

async function assetMarkerStatus(request, env, pathname, expectedMarkers = {}, forbiddenMarkers = {}) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return { path: pathname, available: false, current: false, reason: "ASSETS binding unavailable" };
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
      current: response.ok && Object.values(markers).every(Boolean) && Object.values(forbidden).every(Boolean),
      status: response.status,
      markers,
      forbidden
    };
  } catch (error) {
    return { path: pathname, available: false, current: false, error: error?.message || String(error) };
  }
}

function bootDiagnosticsStatus(request, env) {
  return assetMarkerStatus(request, env, "/boot-diagnostics.js", {
    revision: DIAGNOSTICS_REVISION,
    dynamicSnapshot: "function companionSnapshot()",
    voiceApi: "UnlimitedCompanionVoiceV1711",
    live2dApi: "UnlimitedCompanionStageV1712",
    callApi: "UnlimitedCompanionCallV1713",
    legacyGuard: "legacyCompanionStructuralThemesDisabled"
  });
}

function indexDeliveryStatus(request, env) {
  return assetMarkerStatus(request, env, "/index.html", {
    frontendRevision: FRONTEND_REVISION,
    diagnosticsRevision: DIAGNOSTICS_REVISION,
    bootV1722: "/boot-diagnostics.js?v=20260823-v17.22-final-cleanup-diagnostics",
    workspaceUi: "/workspace-ui-v17.js?v=20260821-v17.0",
    collaboration: "/ai-collaboration-v17.js?v=20260821-v17.0",
    functionPack: "/companion-function-pack-v177.js",
    controls: "/companion-controls-v178.js",
    safeRuntime: "/companion-runtime-safe-v179.js",
    experience: "/companion-experience-v1710.js",
    emotionalVoice: "/companion-voice-suite-v1711.js?v=20260823-v17.21-voice-experience-polish",
    scene: "/companion-scene-v1714.js",
    live2d: "/companion-character-stage-v1712.js?v=20260823-v17.21-emotional-lipsync-owner",
    call: "/companion-call-suite-v1713.js?v=20260823-v17.21-call-voice-polish",
    atmosphere: "/companion-atmosphere-v1715.js",
    luminous: "/companion-luminous-shell-v1719.css"
  }, {
    noLegacyNovelV150: "<script src=\"/novel-workspace-v15.js",
    noLegacyNovelV151: "<script src=\"/novel-workspace-v151.js",
    noLegacyNovelV152: "<script src=\"/novel-workspace-v152.js",
    noLegacyNovelV153: "<script src=\"/novel-workspace-v153.js",
    noCompanionV10: "<script src=\"/companion-v10",
    noCompanionV11: "<script src=\"/companion-v11",
    noCompanionV12: "<script src=\"/companion-v12",
    noOldRuntime: "<script src=\"/companion-runtime.js",
    noOldCall: "<script src=\"/companion-call-mode.js",
    noOldLive2d: "<script src=\"/companion-live2d.js",
    noOldAssetLoader: "<script src=\"/companion-assets-loader"
  });
}

function storageCoreStatus(request, env) {
  return assetMarkerStatus(request, env, "/storage-core-v163.js", {
    revision: "2026-08-20-v16.3-storage-core",
    storageApi: "window.UnlimitedData",
    storageErrors: "uai:storage-error"
  });
}

function workspaceUiStatus(request, env) {
  return assetMarkerStatus(request, env, "/workspace-ui-v17.js", {
    revision: "2026-08-21-v17.0-workspace-ui",
    canonicalApi: "UnlimitedWorkspaceUIV17",
    sharedWorkspaceEvent: "uai:workspace-refresh"
  }, { noPrivateObserver: "new MutationObserver" });
}

function aiCollaborationStatus(request, env) {
  return assetMarkerStatus(request, env, "/ai-collaboration-v17.js", {
    revision: "2026-08-21-v17.0-ai-collaboration",
    canonicalApi: "UnlimitedAICollaborationV17",
    sharedChatEvent: "uai:chat-refresh"
  }, { noPrivateObserver: "new MutationObserver" });
}

function voiceStatus(request, env) {
  return assetMarkerStatus(request, env, "/companion-voice-suite-v1711.js", {
    revision: "2026-08-23-v17.21-voice-experience-polish",
    defaultEve: 'voiceId: "eve"',
    sweetPersona: 'persona: "sweet"',
    emotionalPlan: "EMOTION_PLAN",
    shortSegments: "splitSpeechSegments",
    lookahead: "queue(index + 2)",
    sharedApi: "window.UnlimitedCompanionVoiceV1711"
  }, {
    noFetchWrapper: "window.fetch ="
  });
}

function live2dStatus(request, env) {
  return assetMarkerStatus(request, env, "/companion-character-stage-v1712.js", {
    revision: "2026-08-23-v17.21-emotional-lipsync-owner",
    api: "window.UnlimitedCompanionStageV1712",
    rendererReuse: "rendererHealthy()",
    lipSyncOwner: "emotionalVoiceOwnsLipSync",
    webglRecovery: "webglcontextlost"
  }, {
    noReloadButton: "data-v1712-reload",
    noBodyObserver: "observe(document.body"
  });
}

function sceneStatus(request, env) {
  return assetMarkerStatus(request, env, "/companion-scene-v1714.js", {
    revision: "2026-08-23-v17.14-safe-scene-restore",
    galaxy: '"galaxy"',
    sakura: '"sakura"',
    moonlight: '"moonlight"',
    neon: '"neon"',
    api: "window.UnlimitedCompanionSceneV1714"
  }, { noBodyObserver: "observe(document.body" });
}

function sceneStyleStatus(request, env) {
  return assetMarkerStatus(request, env, "/companion-scene-v1714.css", {
    revision: "V17.18 cinematic companion scene",
    galaxyMeteor: "v1718Meteor",
    sakura: 'data-v1714-scene-theme="sakura"',
    moonlight: 'data-v1714-scene-theme="moonlight"',
    neon: 'data-v1714-scene-theme="neon"',
    reducedMotion: "prefers-reduced-motion"
  });
}

function luminousStatus(request, env) {
  return assetMarkerStatus(request, env, "/companion-luminous-shell-v1719.css", {
    revision: "V17.19 Luminous Shell",
    sidebar: ".uai-c-sidebar",
    live2d: "#uaiCompanionStageV1712",
    glowVariable: "--v1719-glow-a"
  }, {
    noGridColumns: "grid-template-columns:",
    noGridRows: "grid-template-rows:"
  });
}

function callStatus(request, env) {
  return assetMarkerStatus(request, env, "/companion-call-suite-v1713.js", {
    revision: "2026-08-23-v17.21-call-voice-polish",
    api: "window.UnlimitedCompanionCallV1713",
    sharedVoice: "api?.speak",
    stt: 'fetch("/api/companion/stt"',
    vad: "AudioContext",
    autoListen: "autoListen"
  }, {
    noFetchWrapper: "window.fetch =",
    noDedicatedTtsFetch: 'fetch("/api/companion/tts"'
  });
}

async function diagnosticsResponse(request, env, ctx) {
  const inner = await worker.fetch(request, env, ctx);
  let data = {};
  try { data = await inner.clone().json(); } catch {}

  const [
    bootDiagnostics,
    indexDelivery,
    storageCore,
    workspaceUi,
    aiCollaboration,
    voice,
    live2d,
    scene,
    sceneStyle,
    luminous,
    call
  ] = await Promise.all([
    bootDiagnosticsStatus(request, env),
    indexDeliveryStatus(request, env),
    storageCoreStatus(request, env),
    workspaceUiStatus(request, env),
    aiCollaborationStatus(request, env),
    voiceStatus(request, env),
    live2dStatus(request, env),
    sceneStatus(request, env),
    sceneStyleStatus(request, env),
    luminousStatus(request, env),
    callStatus(request, env)
  ]);

  const novelCurrent = Boolean(storageCore.current && workspaceUi.current && aiCollaboration.current && indexDelivery.current);
  const companionCurrent = Boolean(
    bootDiagnostics.current
    && indexDelivery.current
    && voice.current
    && live2d.current
    && scene.current
    && sceneStyle.current
    && luminous.current
    && call.current
  );
  const frontendCurrent = novelCurrent && companionCurrent;

  return json({
    ...data,
    frontendCurrent,
    innerFrontendCurrent: Boolean(data?.frontendCurrent),
    realWorkerEntry: "src/worker-voice.js",
    frontendRevision: FRONTEND_REVISION,
    diagnosticsRevision: DIAGNOSTICS_REVISION,
    gateway: {
      revision: REVISION,
      sameSiteRequired: true,
      rejectsMissingBrowserMetadata: true,
      jsonContentTypeRequired: true,
      rateWindowMs: RATE_WINDOW_MS,
      protectedPostRoutes: [...PROTECTED_POST_ROUTES]
    },
    novel: {
      current: novelCurrent,
      storageCore: storageCore.current,
      workspaceUiV17: workspaceUi.current,
      aiCollaborationV17: aiCollaboration.current
    },
    companion: {
      current: companionCurrent,
      stableCoreEntry: indexDelivery.current,
      bootDiagnostics: bootDiagnostics.current,
      emotionalVoiceV1721: voice.current,
      defaultVoice: "eve",
      integratedLive2d: live2d.current,
      cinematicScene: scene.current && sceneStyle.current,
      luminousShell: luminous.current,
      unifiedCallVoice: call.current,
      legacyStructuralThemesUnloaded: Boolean(
        indexDelivery.forbidden?.noCompanionV10
        && indexDelivery.forbidden?.noCompanionV11
        && indexDelivery.forbidden?.noCompanionV12
      ),
      legacyRuntimeUnloaded: Boolean(indexDelivery.forbidden?.noOldRuntime),
      legacyCallUnloaded: Boolean(indexDelivery.forbidden?.noOldCall),
      legacyLive2dUnloaded: Boolean(indexDelivery.forbidden?.noOldLive2d)
    },
    bootDiagnostics,
    indexDelivery,
    storageCore,
    workspaceUi,
    aiCollaboration,
    voice,
    live2d,
    scene,
    sceneStyle,
    luminous,
    call,
    conclusion: frontendCurrent
      ? "V17.22 diagnostics confirm the current V17.21 companion stack and V17.0 novel workspace are deployed without legacy companion structural themes in the production chain."
      : "One or more current frontend assets or production-chain guards are missing; redeploy current main and inspect the failed marker group."
  }, inner.status || 200);
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

    if (request.method === "POST" && pathname === "/api/companion/tts") return handleCompanionTts(request, env);
    if (request.method === "POST" && pathname === "/api/companion/stt") return handleCompanionStt(request, env);
    if (request.method === "GET" && (pathname === "/api/companion/tts/status" || pathname === "/api/companion/stt/status")) return statusResponse(env);
    if (request.method === "GET" && pathname === "/api/diagnostics") return diagnosticsResponse(request, env, ctx);
    return worker.fetch(request, env, ctx);
  }
};
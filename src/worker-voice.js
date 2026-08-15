import worker from "./worker.js";
import { handleCompanionTts } from "./tts.js";
import { handleCompanionStt } from "./stt.js";

const REVISION = "2026-08-15-v12.17-call-voice-1";

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
    const isVoicePost = request.method === "POST"
      && (url.pathname === "/api/companion/tts" || url.pathname === "/api/companion/stt");

    if (isVoicePost && !sameSiteRequest(request)) return forbidden();

    if (request.method === "POST" && url.pathname === "/api/companion/tts") {
      return handleCompanionTts(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/companion/stt") {
      return handleCompanionStt(request, env);
    }

    if (
      request.method === "GET"
      && (url.pathname === "/api/companion/tts/status" || url.pathname === "/api/companion/stt/status")
    ) {
      return statusResponse(env);
    }

    return worker.fetch(request, env, ctx);
  }
};
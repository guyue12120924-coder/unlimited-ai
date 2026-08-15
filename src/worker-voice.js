import worker from "./worker.js";
import { handleCompanionTts } from "./tts.js";

const REVISION = "2026-08-15-v12.15-neural-voice-1";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/companion/tts") {
      return handleCompanionTts(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/companion/tts/status") {
      return new Response(JSON.stringify({
        available: Boolean(env.AI && typeof env.AI.run === "function"),
        provider: "Cloudflare Workers AI",
        model: "@cf/myshell-ai/melotts",
        revision: REVISION
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    return worker.fetch(request, env, ctx);
  }
};

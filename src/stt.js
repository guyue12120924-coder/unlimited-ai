const STT_MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function transcriptText(result) {
  if (!result) return "";
  if (typeof result.text === "string") return result.text.trim();
  if (typeof result.transcription_info?.text === "string") return result.transcription_info.text.trim();
  if (typeof result.result?.text === "string") return result.result.text.trim();
  return "";
}

export async function handleCompanionStt(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ error: "Workers AI binding is not available", code: "AI_BINDING_MISSING" }, 503);
  }

  const lengthHeader = Number(request.headers.get("content-length") || 0);
  if (lengthHeader > MAX_AUDIO_BYTES) {
    return json({ error: "Audio is too large", code: "AUDIO_TOO_LARGE" }, 413);
  }

  const contentType = String(request.headers.get("content-type") || "application/octet-stream").toLowerCase();
  if (!contentType.startsWith("audio/") && contentType !== "application/octet-stream") {
    return json({ error: "Unsupported audio content type", code: "BAD_AUDIO_TYPE" }, 415);
  }

  let buffer;
  try {
    buffer = await request.arrayBuffer();
  } catch {
    return json({ error: "Unable to read audio" }, 400);
  }
  if (!buffer.byteLength) return json({ error: "Audio is empty" }, 400);
  if (buffer.byteLength > MAX_AUDIO_BYTES) {
    return json({ error: "Audio is too large", code: "AUDIO_TOO_LARGE" }, 413);
  }

  try {
    const result = await env.AI.run(STT_MODEL, {
      audio: arrayBufferToBase64(buffer),
      task: "transcribe",
      language: "zh",
      vad_filter: true,
      condition_on_previous_text: false,
      initial_prompt: "这是中文日常聊天，请准确识别人名、语气词和口语表达。"
    });
    const text = transcriptText(result);
    if (!text) {
      return json({ error: "No speech was recognized", code: "NO_SPEECH" }, 422);
    }
    return json({
      text,
      provider: "Cloudflare Workers AI",
      model: STT_MODEL
    });
  } catch (error) {
    return json({
      error: error?.message || "Speech recognition failed",
      code: "STT_FAILED"
    }, 502);
  }
}

export const companionSttInfo = {
  model: STT_MODEL,
  maxAudioBytes: MAX_AUDIO_BYTES
};
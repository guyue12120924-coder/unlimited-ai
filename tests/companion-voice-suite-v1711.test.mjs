import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-voice-suite-v1711.js', 'utf8');
const css = fs.readFileSync('public/companion-voice-suite-v1711.css', 'utf8');

assert.match(index, /2026-08-23-v17\.20-emotional-voice-system/);
assert.match(index, /companion-voice-suite-v1711\.css\?v=20260823-v17\.20-emotional-voice-system/);
assert.match(index, /companion-voice-suite-v1711\.js\?v=20260823-v17\.20-emotional-voice-system/);
assert.match(js, /2026-08-23-v17\.20-emotional-voice-system/);
assert.match(js, /voiceId:\s*"eve"/, 'Eve must be the new default companion voice');
assert.match(js, /engine:\s*"grok"/, 'Grok TTS must be the default emotional voice engine');
assert.match(js, /playbackRate:\s*\.95/, 'default companion rate should be calmer than 1.0');
assert.match(js, /sweet:[^]*voiceId:\s*"eve"/);
assert.match(js, /gentle:[^]*voiceId:\s*"ara"/);
assert.match(js, /natural:[^]*voiceId:\s*"sal"/);
for (const voice of ['eve', 'ara', 'sal', 'rex', 'leo']) assert.ok(js.includes(`${voice}:`), `missing voice ${voice}`);

assert.match(js, /speechMode:\s*"natural"/);
assert.match(js, /emotionEnabled:\s*true/);
assert.match(js, /function classifyEmotion\(/);
assert.match(js, /function splitSpeechSegments\(/);
assert.match(js, /function buildSpeechPlan\(/);
assert.match(js, /segment\.length <= 138/, 'speech must be split into short expressive segments');
assert.doesNotMatch(js, /function chunkText\([^)]*520/, 'legacy 520-char monotone chunks must stay removed');
assert.match(js, /EMOTION_PLAN/);
for (const emotion of ['happy', 'shy', 'caring', 'sad', 'angry', 'thinking']) assert.ok(js.includes(`${emotion}:`));
assert.match(js, /voice_id:\s*settings\.voiceId/, 'ordinary TTS must send the selected voice id');
assert.match(js, /engine:\s*settings\.engine/, 'ordinary TTS must send the selected engine');
assert.match(js, /uai:companion-voice-profile/, 'voice profile changes must be shared with call mode');
assert.match(js, /CALL_KEY/);
assert.match(js, /setAutoReadSuppressed/);

assert.match(js, /UnlimitedCompanionStageV1712\?\.setMouthOpen|api\.setMouthOpen/);
assert.match(js, /api\?\.setEmotion/);
assert.match(js, /startMouth\(segment\)/);
assert.match(js, /stopMouth\(\)/);
assert.match(js, /\/api\/companion\/tts\/status/);
assert.match(js, /\/api\/companion\/tts/);
assert.match(js, /SpeechSynthesisUtterance/);
assert.match(js, /AbortController/);
assert.match(js, /attributeFilter:\s*\["disabled"\]/);
assert.match(js, /自动朗读新回复/);
assert.match(js, /EMOTIONAL VOICE/);
assert.match(js, /甜美陪伴/);
assert.match(js, /自然陪伴/);
assert.match(js, /试听当前声音/);
assert.match(js, /MONTHLY REVIEW/);

assert.match(js, /function unlockAudio\(/);
assert.match(js, /pointerdown", unlockAudio/);
assert.match(js, /function ensurePlaybackContext\(/);
assert.match(js, /decodeAudioData/);
assert.match(js, /createBufferSource/);
assert.match(js, /function ensureFallbackAudio\(/);
assert.match(js, /uaiCompanionVoiceAudioV1720/);
assert.match(js, /URL\.revokeObjectURL/);
assert.match(js, /浏览器拦截了声音/);

assert.doesNotMatch(js, /window\.fetch\s*=/, 'voice suite must not replace window.fetch');
assert.doesNotMatch(js, /observe\(document\.body/, 'voice suite must not observe the whole body');
assert.doesNotMatch(js, /subtree\s*:\s*true/, 'voice suite must not use subtree-wide MutationObserver');
assert.doesNotMatch(js, /companion-v1[012]/, 'voice suite must not load legacy structural themes');
assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-columns/s);
assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-rows/s);
assert.match(css, /uai-c-v1720-personas/);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.20 emotional companion voice contract passed');
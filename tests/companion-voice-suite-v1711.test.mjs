import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/companion-voice-suite-v1711.js', 'utf8');
const css = fs.readFileSync('public/companion-voice-suite-v1711.css', 'utf8');
const tts = fs.readFileSync('src/tts.js', 'utf8');

assert.match(index, /2026-08-23-v17\.21-voice-experience-polish/);
assert.match(index, /companion-voice-suite-v1711\.css\?v=20260823-v17\.21-voice-experience-polish/);
assert.match(index, /companion-voice-suite-v1711\.js\?v=20260823-v17\.21-voice-experience-polish/);
assert.match(js, /2026-08-23-v17\.21-voice-experience-polish/);
assert.match(js, /voiceId:\s*"eve"/);
assert.match(js, /engine:\s*"grok"/);
assert.match(js, /playbackRate:\s*\.95/);
assert.match(js, /sweet:[^]*voiceId:\s*"eve"/);
assert.match(js, /gentle:[^]*voiceId:\s*"ara"/);
assert.match(js, /natural:[^]*voiceId:\s*"sal"/);
for (const voice of ['eve', 'ara', 'sal', 'rex', 'leo']) assert.ok(js.includes(`${voice}:`), `missing voice ${voice}`);

assert.match(js, /legacyProfile/);
assert.match(js, /legacyProfile\s*\?\s*DEFAULTS\.playbackRate/);
assert.match(js, /speechMode:\s*"natural"/);
assert.match(js, /emotionEnabled:\s*true/);
assert.match(js, /function classifyEmotion\(/);
assert.match(js, /function splitSpeechSegments\(/);
assert.match(js, /function buildSpeechPlan\(/);
assert.match(js, /segment\.length <= 138/);
assert.doesNotMatch(js, /function chunkText\([^)]*520/);
assert.match(js, /EMOTION_PLAN/);
for (const emotion of ['happy', 'shy', 'caring', 'sad', 'angry', 'thinking']) assert.ok(js.includes(`${emotion}:`));
assert.ok(js.includes('.replace(/\\*[^*]{1,260}\\*/g, "，")'));
assert.ok(js.includes('.replace(/\\*/g, " ")'));

// V17.21: neutral segments inherit the reply/previous emotion instead of snapping back to monotone.
assert.match(js, /const globalEmotion = settings\.emotionEnabled \? classifyEmotion\(text\) : "neutral"/);
assert.match(js, /let previousEmotion = globalEmotion/);
assert.match(js, /if \(emotion === "neutral"\) emotion = previousEmotion !== "neutral" \? previousEmotion : globalEmotion/);

// V17.21: first segment starts directly and only a small look-ahead window is prefetched.
assert.match(js, /const pending = new Map\(\)/);
assert.match(js, /queue\(0\);\s*queue\(1\);/);
assert.match(js, /queue\(index \+ 2\)/);
assert.doesNotMatch(js, /const pending = plan\.map/);
assert.doesNotMatch(js, /const available = await checkStatus\(\)/, 'normal playback must not wait for a status preflight');
assert.match(js, /No preflight status request here/);

assert.match(js, /voice_id:\s*settings\.voiceId/);
assert.match(js, /engine:\s*settings\.engine/);
assert.match(js, /uai:companion-voice-profile/);
assert.match(js, /setAutoReadSuppressed/);
assert.match(js, /function previewVoice\(/);
assert.match(js, /data-v1721-ab="eve"/);
assert.match(js, /data-v1721-ab="ara"/);
assert.match(js, /只试听，不修改角色声音/);
assert.match(js, /A \/ B 快速试听/);

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
assert.match(js, /uaiCompanionVoiceAudioV1721/);

assert.match(tts, /const DEFAULT_GROK_VOICE = "eve";/);
assert.match(tts, /payload\?\.voice_id \|\| DEFAULT_GROK_VOICE/);
assert.match(tts, /defaultVoice:\s*DEFAULT_GROK_VOICE/);

assert.doesNotMatch(js, /window\.fetch\s*=/);
assert.doesNotMatch(js, /observe\(document\.body/);
assert.doesNotMatch(js, /subtree\s*:\s*true/);
assert.doesNotMatch(js, /companion-v1[012]/);
assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-columns/s);
assert.doesNotMatch(css, /#uaiCompanionRoot\s*\{[^}]*grid-template-rows/s);
assert.match(css, /uai-c-v1720-personas/);
assert.match(css, /uai-c-v1721-compare/);
assert.match(css, /prefers-reduced-motion/);

console.log('V17.21 emotional voice experience contract passed');
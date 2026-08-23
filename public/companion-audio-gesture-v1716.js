// V17.16 companion audio gesture guard. Scoped events only; no observers and no transport changes.
(() => {
  const REVISION = "2026-08-23-v17.16-audio-gesture-guard";
  if (window.UnlimitedCompanionAudioGestureV1716) return;

  function root() {
    if (document.body.dataset.uaiMode !== "companion") return null;
    const host = document.getElementById("uaiCompanionRoot");
    return host && !host.hidden && host.isConnected ? host : null;
  }

  function voiceApi() {
    return window.UnlimitedCompanionVoiceV1711 || null;
  }

  function callApi() {
    return window.UnlimitedCompanionCallV1713 || null;
  }

  function insideCompanion(event) {
    const host = root();
    return Boolean(host && event?.target && host.contains(event.target));
  }

  function unlockEnabledVoice() {
    const voice = voiceApi();
    if (!voice?.unlockAudio || voice.audioUnlocked) return;
    try {
      if (voice.getSettings?.().enabled) voice.unlockAudio();
    } catch {}
  }

  function unlockCallIfRelevant(event) {
    const target = event?.target?.closest?.(
      "#uaiCompanionCallButtonV1713, #uaiCompanionCallV1713 [data-v1713-speaker], #uaiCompanionCallV1713 [data-v1713-listen]"
    );
    if (!target) return;
    try { callApi()?.unlockAudio?.(); } catch {}
  }

  function onPointerDown(event) {
    if (!insideCompanion(event)) return;
    unlockEnabledVoice();
    unlockCallIfRelevant(event);
  }

  function onClickCapture(event) {
    if (!insideCompanion(event)) return;
    const speaker = event.target?.closest?.("#uaiCompanionCallV1713 [data-v1713-speaker]");
    if (!speaker) return;
    const call = callApi();
    if (!call?.active || !call.lastPlaybackError || !call.getSettings?.().speaker) return;

    // The speaker is already enabled. On a playback-policy failure this click means
    // "retry sound", not "turn the speaker off". Stop the old toggle handler and retry.
    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(call.unlockAudio?.())
      .then(() => call.retryVoice?.())
      .catch(() => {});
  }

  document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  document.addEventListener("click", onClickCapture, true);

  window.UnlimitedCompanionAudioGestureV1716 = {
    revision: REVISION,
    refresh() {
      if (!root()) return false;
      unlockEnabledVoice();
      return true;
    }
  };
})();
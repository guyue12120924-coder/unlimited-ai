// public/chat-context-core-v163.js
// V16.4 context core: register novel context providers onto one Chat Transport entry.
(() => {
  const REVISION = "2026-08-21-v16.4-chat-context-core";
  if (window.UnlimitedChatContextV163) return;

  function buildCreativeContext(payload = {}) {
    return window.UnlimitedContext?.buildContext?.(payload) || null;
  }

  function creativeEnricher(payload) {
    const context = buildCreativeContext(payload);
    return { creative_context: context || undefined };
  }

  function memoryEnricher(payload) {
    const memories = window.UnlimitedMemory?.selectRelevantMemories?.(payload) || [];
    return {
      memory_context: memories.length
        ? { version: 1, items: memories }
        : undefined
    };
  }

  function continuityEnricher() {
    const continuity = window.UnlimitedContinuity?.currentPayload?.() || null;
    return { continuity_context: continuity || undefined };
  }

  function install() {
    const transport = window.UnlimitedChatTransportV16;
    if (!transport?.registerNovelEnricher || typeof transport.fetch !== "function") {
      window.__UNLIMITED_CHAT_CONTEXT_ERROR__ = {
        revision: REVISION,
        message: "V16 Chat Transport registry is unavailable"
      };
      return false;
    }

    if (!window.UnlimitedContext?.buildContext) {
      window.__UNLIMITED_CHAT_CONTEXT_ERROR__ = {
        revision: REVISION,
        message: "Canonical creative-context builder is unavailable"
      };
      return false;
    }

    transport.registerNovelEnricher("creative-context", creativeEnricher);
    transport.registerNovelEnricher("story-memory", memoryEnricher);
    transport.registerNovelEnricher("continuity", continuityEnricher);

    // V16.4 invariant: one network entry after all context providers initialize.
    window.fetch = transport.fetch;
    window.fetch.__uaiV16Transport = transport.revision;
    window.fetch.__uaiV16Registry = transport.registryRevision;
    window.fetch.__uaiV16ContextCore = REVISION;

    document.documentElement.dataset.chatContextRevision = REVISION;
    return true;
  }

  const installed = install();
  window.UnlimitedChatContextV163 = {
    revision: REVISION,
    installed,
    buildCreativeContext,
    creativeEnricher,
    memoryEnricher,
    continuityEnricher,
    get enrichers() { return window.UnlimitedChatTransportV16?.enrichers || []; }
  };
})();

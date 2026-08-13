(() => {
  const MODEL_LABELS = new Map((window.APP_MODELS || []).map(model => [model.id, model.label]));

  try {
    const allowed = new Set((window.APP_MODELS || []).map((model) => model.id));
    const saved = localStorage.getItem("cfw_model");
    if (!saved || !allowed.has(saved)) {
      const fallback = window.APP_DEFAULT_MODEL || window.APP_MODELS?.[0]?.id;
      if (fallback) localStorage.setItem("cfw_model", fallback);
    }
  } catch {
    // Storage migration is best-effort only.
  }

  const originalFetch = window.fetch.bind(window);

  function labelFor(modelId) {
    return MODEL_LABELS.get(modelId) || modelId || "未知模型";
  }

  function findLatestAiStats() {
    const stats = document.querySelectorAll(".row.ai .stats");
    return stats.length ? stats[stats.length - 1] : null;
  }

  function applyRouteStatus(detail) {
    const stats = findLatestAiStats();
    if (!stats || !detail) return;

    const requested = detail.requested;
    const used = detail.used;
    const fallback = detail.fallback || "";
    if (!requested && !used) return;

    const requestedLabel = labelFor(requested || used);
    const usedLabel = labelFor(used || requested);
    const switched = requested && used && requested !== used;

    stats.dataset.modelRoute = switched
      ? `选择：${requestedLabel} → 实际：${usedLabel}`
      : `实际模型：${usedLabel}`;

    stats.classList.toggle("model-fallback", Boolean(switched));
    if (fallback) stats.title = `自动切换原因：${fallback}`;
    else stats.removeAttribute("title");
  }

  window.addEventListener("unlimited-ai:model-route", (event) => {
    applyRouteStatus(event.detail);
  });

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    try {
      const target = args[0];
      const url = typeof target === "string" ? target : target?.url || "";
      if (url.includes("/api/chat")) {
        const requested = response.headers.get("X-Requested-Model");
        const used = response.headers.get("X-Model-Used");
        const fallback = response.headers.get("X-Model-Fallback");

        window.dispatchEvent(new CustomEvent("unlimited-ai:model-route", {
          detail: { requested, used, fallback }
        }));
      }
    } catch {
      // Model-route display is diagnostic only; never interfere with chat requests.
    }

    return response;
  };

  const style = document.createElement("style");
  style.textContent = `
    .row.ai .stats[data-model-route]::before {
      content: attr(data-model-route) " · ";
      font-weight: 600;
    }
    .row.ai .stats.model-fallback::before {
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
  `;
  document.head.appendChild(style);

  // Prompt controls are loaded from this stable bootstrap point so both the
  // novel workspace and the dynamically mounted companion UI can use them.
  if (!document.getElementById("uaiPromptControlCss")) {
    const link = document.createElement("link");
    link.id = "uaiPromptControlCss";
    link.rel = "stylesheet";
    link.href = `/prompt-center.css?v=${encodeURIComponent(window.APP_REVISION || "prompt-control-2")}`;
    document.head.appendChild(link);
  }
  if (!document.getElementById("uaiPromptControlScript")) {
    const script = document.createElement("script");
    script.id = "uaiPromptControlScript";
    script.src = `/prompt-control.js?v=${encodeURIComponent(window.APP_REVISION || "prompt-control-2")}`;
    script.async = true;
    document.body.appendChild(script);
  }
})();

(() => {
  const MODEL_LABELS = {
    "nvidia/nemotron-3-super-120b-a12b": "Nemotron 3 Super 120B",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5": "Llama 3.3 Nemotron Super 49B",
    "openai/gpt-oss-120b": "GPT-OSS 120B"
  };

  try {
    const allowed = new Set((window.APP_MODELS || []).map((m) => m.id));
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
    return MODEL_LABELS[modelId] || modelId || "未知模型";
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
    if (fallback) {
      stats.title = `自动切换原因：${fallback}`;
    } else {
      stats.removeAttribute("title");
    }
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
})();

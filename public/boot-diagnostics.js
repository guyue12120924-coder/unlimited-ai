// public/boot-diagnostics.js
// Captures startup failures so the UI never silently falls back to the base chat shell.
(() => {
  const REVISION = "2026-08-09-v2-boot-1";
  const errors = [];

  document.documentElement.dataset.frontendRevision = REVISION;
  window.__UNLIMITED_BOOT__ = {
    revision: REVISION,
    startedAt: Date.now(),
    errors
  };

  function describeError(event) {
    if (event?.reason) {
      return event.reason?.stack || event.reason?.message || String(event.reason);
    }
    return event?.error?.stack || event?.error?.message || event?.message || "Unknown frontend error";
  }

  window.addEventListener("error", (event) => {
    errors.push(describeError(event));
  });

  window.addEventListener("unhandledrejection", (event) => {
    errors.push(describeError(event));
  });

  function showFailure(message) {
    if (document.getElementById("frontendBootFailure")) return;
    const panel = document.createElement("div");
    panel.id = "frontendBootFailure";
    panel.setAttribute("role", "alert");
    panel.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:99999",
      "max-width:520px",
      "padding:12px 14px",
      "border:1px solid rgba(239,140,130,.55)",
      "border-radius:10px",
      "background:rgba(30,16,16,.96)",
      "color:#ffe8e5",
      "box-shadow:0 18px 50px rgba(0,0,0,.45)",
      "font:12px/1.55 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "white-space:pre-wrap"
    ].join(";");
    panel.textContent = `前端初始化失败（${REVISION}）\n${message}`;
    document.body.appendChild(panel);
  }

  function verifyBoot() {
    const expected = [
      ["creativeWorkspace", "创作工作区"],
      ["contextInspectorBtn", "上下文"],
      ["continuityBtn", "连续性"],
      ["storyMemoryBtn", "记忆"]
    ];
    const missing = expected.filter(([id]) => !document.getElementById(id));
    if (!missing.length) {
      window.__UNLIMITED_BOOT__.ready = true;
      return;
    }

    const details = errors.length
      ? `\n捕获到的错误：\n${errors.slice(0, 5).join("\n\n")}`
      : "\n没有捕获到 JS 异常，可能是脚本未执行或资源被浏览器阻止。";
    showFailure(`缺少：${missing.map(([, label]) => label).join("、")}${details}`);
  }

  function scheduleVerification() {
    window.setTimeout(verifyBoot, 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleVerification, { once: true });
  } else {
    scheduleVerification();
  }
})();

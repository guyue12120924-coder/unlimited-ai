import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const runtimeSource = fs.readFileSync("public/v3-runtime.js", "utf8");
const historySource = fs.readFileSync("public/history-lifecycle-v16.js", "utf8");
const index = fs.readFileSync("public/index.html", "utf8");

class FakeNativeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.records = [];
    this.connected = false;
  }
  observe() { this.connected = true; }
  disconnect() { this.connected = false; }
  takeRecords() {
    const out = this.records.splice(0);
    return out;
  }
  emit(records) {
    if (this.connected) this.callback(records, this);
  }
}

const listeners = new Map();
const document = {
  readyState: "complete",
  visibilityState: "visible",
  documentElement: { dataset: {} },
  querySelector() { return null; },
  getElementById() { return null; },
  addEventListener(type, handler) { listeners.set(`document:${type}`, handler); }
};

const sandbox = {
  window: null,
  document,
  MutationObserver: FakeNativeMutationObserver,
  requestAnimationFrame(callback) { return setTimeout(callback, 0); },
  cancelAnimationFrame(id) { clearTimeout(id); },
  setTimeout,
  clearTimeout,
  queueMicrotask,
  console
};
sandbox.window = sandbox;
sandbox.addEventListener = (type, handler) => listeners.set(`window:${type}`, handler);

const context = vm.createContext(sandbox);
vm.runInContext(runtimeSource, context, { filename: "v3-runtime.js" });

assert.equal(context.MutationObserver, FakeNativeMutationObserver, "V16.5 must leave global MutationObserver untouched");
assert.equal(context.UnlimitedV3.revision, "2026-08-21-v16.5-observer-scheduler");
assert.equal(typeof context.UnlimitedV3.createObserver, "function");
assert.equal(typeof context.UnlimitedV3.schedule, "function");
assert.equal(context.UnlimitedV3.diagnostics().globalObserverUntouched, true);

let callbackCount = 0;
let deliveredRecords = 0;
const observer = context.UnlimitedV3.createObserver((records) => {
  callbackCount += 1;
  deliveredRecords += records.length;
});
observer.observe({}, { childList: true });
observer.__native.emit([{ type: "childList" }]);
observer.__native.emit([{ type: "attributes" }]);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(callbackCount, 1, "explicit coordinated observer should batch same-frame deliveries");
assert.equal(deliveredRecords, 2);

assert.match(historySource, /2026-08-21-v16\.5-history-ui/);
assert.match(historySource, /core\.setPersistence/);
assert.doesNotMatch(historySource, /Storage\.prototype\.(?:getItem|setItem|removeItem)\s*=/);
assert.match(index, /history-lifecycle-v16\.js\?v=20260821-v16\.5/);
assert.match(index, /v3-runtime\.js\?v=20260821-v16\.5/);

console.log("V16.5 runtime cleanup contract passed: native MutationObserver remains global, explicit batching still works, and history persistence is Storage-Core-owned.");

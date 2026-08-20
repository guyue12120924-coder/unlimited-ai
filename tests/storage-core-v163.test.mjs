import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("public/storage-core-v163.js", "utf8");

class FakeStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    const value = this.map.get(String(key));
    return value === undefined ? null : value;
  }
  setItem(key, value) {
    this.map.set(String(key), String(value));
  }
  removeItem(key) {
    this.map.delete(String(key));
  }
}

const localStorage = new FakeStorage();
const sessionStorage = new FakeStorage();
const events = [];
const sandbox = {
  Storage: FakeStorage,
  localStorage,
  sessionStorage,
  document: { documentElement: { dataset: {} } },
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  setTimeout,
  clearTimeout,
  console
};
sandbox.window = sandbox;
sandbox.dispatchEvent = (event) => { events.push(event); return true; };

const context = vm.createContext(sandbox);
vm.runInContext(source, context, { filename: "storage-core-v163.js" });

assert.equal(context.UnlimitedStorageV163.revision, "2026-08-20-v16.3-storage-core");
assert.equal(context.document.documentElement.dataset.storageCoreRevision, "2026-08-20-v16.3-storage-core");
assert.equal(context.UnlimitedStorageV163.persistent, false, "fresh installs default to non-persistent novel history");

const descriptor = Object.getOwnPropertyDescriptor(FakeStorage.prototype, "setItem");
assert.equal(descriptor?.writable, false, "V16.3 must prevent later direct prototype reassignment");
const guardedSetItem = FakeStorage.prototype.setItem;
vm.runInContext("Storage.prototype.setItem = function legacyOverride() {};", context);
assert.equal(FakeStorage.prototype.setItem, guardedSetItem, "legacy monkey patches must not replace the storage gateway");

const firstSessions = JSON.stringify([{ id: "s1", messages: [{ role: "user", content: "hello" }] }]);
localStorage.setItem("cfw_sessions_v2", firstSessions);
assert.equal(localStorage.map.has("cfw_sessions_v2"), false, "disabled persistence must not write durable sessions");
assert.equal(sessionStorage.getItem("uai_v16_ephemeral_novel_sessions"), firstSessions);
assert.equal(localStorage.getItem("cfw_sessions_v2"), firstSessions, "legacy readers still see the live ephemeral session source");

localStorage.setItem("cfw_history_persist_v16", "1");
assert.equal(context.UnlimitedStorageV163.persistent, true);
assert.equal(localStorage.map.get("cfw_sessions_v2"), firstSessions, "enabling persistence promotes the live session set");
assert.equal(sessionStorage.getItem("uai_v16_ephemeral_novel_sessions"), null);

const durableSessions = JSON.stringify([{ id: "s2", messages: [{ role: "assistant", content: "saved" }] }]);
localStorage.setItem("cfw_sessions_v2", durableSessions);
assert.equal(localStorage.map.get("cfw_sessions_v2"), durableSessions);

localStorage.setItem("cfw_history_persist_v16", "0");
assert.equal(context.UnlimitedStorageV163.persistent, false);
assert.equal(sessionStorage.getItem("uai_v16_ephemeral_novel_sessions"), durableSessions, "disabling persistence seeds the same-page transient mirror");
assert.equal(localStorage.getItem("cfw_sessions_v2"), durableSessions, "current page remains consistent after disabling persistence");

context.UnlimitedData = {
  normalizeSessions(value) {
    return {
      value: value.map((item) => ({ ...item, normalizedByV163Test: true })),
      changed: true
    };
  },
  normalizeWorkspace(value) {
    return { value: { ...value, normalizedByV163Test: true }, changed: true };
  }
};

localStorage.setItem("cfw_sessions_v2", JSON.stringify([{ id: "normalized" }]));
const normalizedSessions = JSON.parse(sessionStorage.getItem("uai_v16_ephemeral_novel_sessions"));
assert.equal(normalizedSessions[0].normalizedByV163Test, true, "runtime session writes must still use UnlimitedData normalization");

localStorage.setItem("cfw_studio_workspace_v1", JSON.stringify({ projects: [] }));
const normalizedWorkspace = JSON.parse(localStorage.map.get("cfw_studio_workspace_v1"));
assert.equal(normalizedWorkspace.normalizedByV163Test, true, "workspace writes must still use UnlimitedData normalization");

assert.equal(localStorage.getItem("cfw_history_enabled"), "1", "legacy app.js must always see one live session source");
assert.equal(events.length, 0, "normal storage lifecycle should not emit storage errors");

console.log("V16.3 storage core VM contract passed: single gateway, ephemeral/durable history routing and normalization are functional.");
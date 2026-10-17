import { getSettings, snapshot, saveSession, restoreWindows } from './lib.js';

// ---- Toolbar badge with the open tab count ----

async function updateBadge() {
  const { badge } = await getSettings();
  if (!badge) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  const tabs = await chrome.tabs.query({});
  await chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
  await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await chrome.action.setBadgeText({ text: tabs.length > 999 ? '999+' : String(tabs.length) });
}

async function flashBadge(text, color) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(updateBadge, 1500);
}

// ---- Auto-save for crash / restart recovery ----
// "autosave" mirrors the current browser run. On the first save of a new run,
// the previous run's copy is moved to "lastSession" so a crash or a restart
// that opens a blank window does not overwrite it.

let archiving;
function archivePreviousRun() {
  archiving ??= (async () => {
    const { archived } = await chrome.storage.session.get('archived');
    if (archived) return;
    await chrome.storage.session.set({ archived: true });
    const { autosave } = await chrome.storage.local.get('autosave');
    if (autosave) await chrome.storage.local.set({ lastSession: autosave });
  })();
  return archiving;
}

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(autosave, 2000);
}

async function autosave() {
  await archivePreviousRun();
  const { autosave: enabled } = await getSettings();
  if (!enabled) return;
  const windows = await snapshot();
  if (!windows.length) return;
  await chrome.storage.local.set({
    autosave: { id: 'autosave', name: 'Previous browsing session', created: Date.now(), windows },
  });
}

// ---- Events ----

chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  scheduleAutosave();
});

chrome.runtime.onStartup.addListener(() => {
  archivePreviousRun();
  updateBadge();
});

chrome.tabs.onCreated.addListener(() => {
  updateBadge();
  scheduleAutosave();
});

chrome.tabs.onRemoved.addListener((_id, info) => {
  updateBadge();
  // When a window or the whole browser is closing, keep the last full snapshot.
  if (info.isWindowClosing) clearTimeout(autosaveTimer);
  else scheduleAutosave();
});

chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.url || change.title || change.pinned !== undefined) scheduleAutosave();
});

chrome.tabs.onMoved.addListener(scheduleAutosave);
chrome.tabs.onAttached.addListener(scheduleAutosave);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) updateBadge();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-all') return;
  try {
    await saveSession();
    await flashBadge('OK', '#16a34a');
  } catch {
    await flashBadge('!', '#dc2626');
  }
});

// ---- Messages from the popup ----

async function closeSavedTabs(windowId) {
  const normal = (await chrome.windows.getAll({ windowTypes: ['normal'] })).filter((w) => !w.incognito);
  const winIds = windowId != null ? [windowId] : normal.map((w) => w.id);
  if (!winIds.length) return;
  const focused = normal.find((w) => w.focused);
  const keepWindow = windowId ?? focused?.id ?? winIds[0];

  // Open a fresh tab first so the window stays open, then close the saved tabs.
  // Pinned tabs are left alone.
  const fresh = await chrome.tabs.create({ windowId: keepWindow, active: true });
  const toClose = [];
  for (const id of winIds) {
    for (const t of await chrome.tabs.query({ windowId: id })) {
      if (t.id !== fresh.id && !t.pinned) toClose.push(t.id);
    }
  }
  if (toClose.length) await chrome.tabs.remove(toClose);
}

const handlers = {
  restore: (msg) => restoreWindows(msg.windows),
  'close-saved': (msg) => closeSavedTabs(msg.windowId),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return;
  handler(msg).then(
    () => sendResponse({ ok: true }),
    (err) => sendResponse({ ok: false, error: String(err?.message || err) }),
  );
  return true;
});

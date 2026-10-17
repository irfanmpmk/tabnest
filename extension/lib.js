// Shared helpers used by the popup, options page and background service worker.

export const DEFAULT_SETTINGS = {
  autosave: true,
  badge: true,
  closeAfterSave: false,
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function setSettings(patch) {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...patch } });
}

export async function getSessions() {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  return sessions;
}

export async function setSessions(sessions) {
  await chrome.storage.local.set({ sessions });
}

export function countTabs(session) {
  return session.windows.reduce((n, w) => n + w.tabs.length, 0);
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Uses Chrome's local favicon cache, so no requests go out to websites.
export function favicon(pageUrl, size = 32) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl || '');
  u.searchParams.set('size', String(size));
  return u.toString();
}

export function defaultName() {
  return new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function isWorthSaving(url) {
  return !!url && !/^(chrome|edge):\/\/newtab/.test(url) && url !== 'about:blank';
}

function toSavedTab(tab) {
  const url = tab.url || tab.pendingUrl;
  if (!isWorthSaving(url)) return null;
  return { url, title: tab.title || url, pinned: !!tab.pinned };
}

// Captures one window (windowId given) or every normal, non-incognito window.
export async function snapshot(windowId) {
  const wins = windowId != null
    ? [await chrome.windows.get(windowId, { populate: true })]
    : await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  return wins
    .filter((w) => !w.incognito)
    .map((w) => ({ tabs: w.tabs.map(toSavedTab).filter(Boolean) }))
    .filter((w) => w.tabs.length);
}

export async function saveSession(name, windowId) {
  const windows = await snapshot(windowId);
  if (!windows.length) throw new Error('There are no tabs to save.');
  const session = {
    id: crypto.randomUUID(),
    name: name || defaultName(),
    created: Date.now(),
    windows,
  };
  const sessions = await getSessions();
  sessions.unshift(session);
  await setSessions(sessions);
  return session;
}

// Runs in the background worker: opening windows closes the popup, which would
// stop any code still running there.
export async function restoreWindows(windows) {
  for (const w of windows) {
    const win = await chrome.windows.create({ focused: true });
    const blankTabId = win.tabs[0].id;
    let opened = 0;
    for (const t of w.tabs) {
      try {
        await chrome.tabs.create({ windowId: win.id, url: t.url, pinned: t.pinned, active: opened === 0 });
        opened++;
      } catch (err) {
        console.warn('TabNest: could not open', t.url, err);
      }
    }
    if (opened) await chrome.tabs.remove(blankTabId);
  }
}

// ---- Import / validation ----

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'ftp:', 'file:', 'chrome:', 'about:']);

function safeUrl(url) {
  try {
    return typeof url === 'string' && SAFE_PROTOCOLS.has(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

export function sanitizeSession(s) {
  if (!s || !Array.isArray(s.windows)) return null;
  const windows = s.windows
    .map((w) => ({
      tabs: (Array.isArray(w?.tabs) ? w.tabs : [])
        .map((t) => {
          const url = safeUrl(t?.url);
          return url && { url, title: String(t.title || url).slice(0, 500), pinned: !!t.pinned };
        })
        .filter(Boolean),
    }))
    .filter((w) => w.tabs.length);
  if (!windows.length) return null;
  return {
    id: typeof s.id === 'string' && s.id ? s.id : crypto.randomUUID(),
    name: String(s.name || 'Imported session').slice(0, 100),
    created: Number(s.created) || Date.now(),
    windows,
  };
}

// Parses OneTab's export format ("url | title" per line, groups separated by
// blank lines). A plain list of URLs works too.
export function parseUrlList(text) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((group, i) => {
      const tabs = group
        .split(/\r?\n/)
        .map((line) => {
          const sep = line.indexOf(' | ');
          const url = safeUrl((sep === -1 ? line : line.slice(0, sep)).trim());
          const title = sep === -1 ? '' : line.slice(sep + 3).trim();
          return url && { url, title: title || url, pinned: false };
        })
        .filter(Boolean);
      return tabs.length && {
        id: crypto.randomUUID(),
        name: `Imported group ${i + 1}`,
        created: Date.now(),
        windows: [{ tabs }],
      };
    })
    .filter(Boolean);
}

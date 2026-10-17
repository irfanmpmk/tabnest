import { getSettings, setSettings, getSessions, setSessions, saveSession, countTabs, favicon, hostOf } from './lib.js';
import { $, el, icon, confirmButton, formatDate, plural } from './ui.js';

let currentWindowId;
let visibleTabs = [];
const expanded = new Set();

let toastTimer;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---- View switching ----

const renderers = { tabs: renderTabs, sessions: renderSessions };

function show(view) {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#view-tabs').hidden = view !== 'tabs';
  $('#view-sessions').hidden = view !== 'sessions';
  renderers[view]();
}

document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
$('#openOptions').append(icon('settings'));
$('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

// ---- Open tabs ----

function normalize(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}

function findDuplicates(tabs) {
  const groups = new Map();
  for (const t of tabs) {
    if (!t.url) continue;
    const key = normalize(t.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const dupes = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const keep = group.find((t) => t.active) || group.find((t) => t.pinned) || group[0];
    dupes.push(...group.filter((t) => t !== keep && !t.pinned));
  }
  return dupes;
}

const matches = (t, q) => (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q);

async function getWindows() {
  const [wins, current] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
    chrome.windows.getCurrent(),
  ]);
  currentWindowId = current.id;
  // Current window first.
  return wins.sort((a, b) => (b.id === current.id) - (a.id === current.id));
}

async function renderTabs() {
  const q = $('#search').value.trim().toLowerCase();
  const wins = await getWindows();
  const allTabs = wins.flatMap((w) => w.tabs);
  $('#tabCount').textContent = allTabs.length;

  const dupes = findDuplicates(allTabs);
  const dedupe = $('#dedupe');
  dedupe.textContent = dupes.length ? `Close ${plural(dupes.length, 'duplicate')}` : 'No duplicates';
  dedupe.disabled = !dupes.length;

  const list = $('#tabList');
  list.replaceChildren();
  visibleTabs = [];
  wins.forEach((w, i) => {
    const tabs = q ? w.tabs.filter((t) => matches(t, q)) : w.tabs;
    if (!tabs.length) return;
    visibleTabs.push(...tabs);
    if (wins.length > 1) {
      list.append(el('div', { class: 'group' },
        w.id === currentWindowId ? 'This window' : `Window ${i + 1}`,
        el('span', {}, String(tabs.length))));
    }
    for (const t of tabs) list.append(tabRow(t));
  });
  if (!visibleTabs.length) {
    list.append(el('p', { class: 'empty' }, q ? 'No tabs match your search.' : 'No open tabs.'));
  }
}

function tabRow(t) {
  return el('div', {
    class: 'row' + (t.active && t.windowId === currentWindowId ? ' current' : ''),
    title: t.url,
    onclick: () => focusTab(t),
  },
  el('img', { class: 'fav', src: favicon(t.url), alt: '' }),
  el('div', { class: 'text' },
    el('div', { class: 'title' }, t.title || t.url),
    el('div', { class: 'sub' }, hostOf(t.url) || t.url)),
  t.pinned && el('span', { class: 'pin' }, 'PINNED'),
  el('button', {
    type: 'button',
    class: 'icon-btn reveal',
    title: 'Close tab',
    onclick: async (e) => {
      e.stopPropagation();
      await chrome.tabs.remove(t.id);
      renderTabs();
    },
  }, icon('close')));
}

async function focusTab(t) {
  await chrome.tabs.update(t.id, { active: true });
  await chrome.windows.update(t.windowId, { focused: true });
  window.close();
}

$('#search').addEventListener('input', renderTabs);
$('#search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && visibleTabs.length) focusTab(visibleTabs[0]);
});

$('#dedupe').addEventListener('click', async () => {
  const wins = await getWindows();
  const dupes = findDuplicates(wins.flatMap((w) => w.tabs));
  if (!dupes.length) return;
  await chrome.tabs.remove(dupes.map((t) => t.id));
  toast(`Closed ${plural(dupes.length, 'duplicate tab')}`);
  renderTabs();
});

$('#sort').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const pinnedCount = tabs.filter((t) => t.pinned).length;
  const sorted = tabs
    .filter((t) => !t.pinned)
    .sort((a, b) => hostOf(a.url).localeCompare(hostOf(b.url)) || (a.title || '').localeCompare(b.title || ''));
  if (sorted.length) await chrome.tabs.move(sorted.map((t) => t.id), { index: pinnedCount });
  toast('Sorted tabs by website');
  renderTabs();
});

// ---- Sessions ----

async function updateSession(id, change) {
  const sessions = await getSessions();
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  change(s);
  s.windows = s.windows.filter((w) => w.tabs.length);
  await setSessions(sessions.filter((x) => x.windows.length));
}

async function deleteSession(id) {
  await setSessions((await getSessions()).filter((x) => x.id !== id));
}

function restore(session) {
  // The background worker opens the windows; the popup closes as soon as one appears.
  chrome.runtime.sendMessage({ type: 'restore', windows: session.windows });
}

async function renderSessions() {
  const [sessions, { lastSession }, settings] = await Promise.all([
    getSessions(),
    chrome.storage.local.get('lastSession'),
    getSettings(),
  ]);
  $('#closeAfter').checked = settings.closeAfterSave;

  const list = $('#sessionList');
  list.replaceChildren();
  if (lastSession) list.append(sessionCard(lastSession, true));
  if (!sessions.length) {
    list.append(el('p', { class: 'empty' }, 'No saved sessions yet. Save this window to keep its tabs for later.'));
  }
  for (const s of sessions) list.append(sessionCard(s, false));
}

function sessionCard(s, isRecovery) {
  const tabTotal = countTabs(s);
  const isOpen = expanded.has(s.id);
  const meta = [plural(tabTotal, 'tab')];
  if (s.windows.length > 1) meta.push(plural(s.windows.length, 'window'));
  meta.push(formatDate(s.created));

  const body = el('div', { class: 'session-tabs', hidden: !isOpen });
  if (isOpen) fillSessionTabs(body, s, isRecovery);

  const toggle = () => {
    if (expanded.has(s.id)) expanded.delete(s.id);
    else expanded.add(s.id);
    renderSessions();
  };

  const titleEl = el('div', { class: 'title' }, isRecovery ? 'Previous browsing session' : s.name);
  const text = el('div', { class: 'text', onclick: toggle, title: 'Show tabs' },
    titleEl,
    el('div', { class: 'sub' }, meta.join(' · ')));

  const head = el('div', { class: 'card-head' },
    el('button', { type: 'button', class: 'icon-btn chev' + (isOpen ? ' open' : ''), title: 'Show tabs', onclick: toggle }, icon('chevron')),
    text,
    el('button', { type: 'button', class: 'btn small', title: 'Open these tabs in a new window', onclick: () => restore(s) }, 'Restore'));

  if (!isRecovery) {
    head.append(
      el('button', { type: 'button', class: 'icon-btn', title: 'Rename', onclick: () => startRename(s, titleEl) }, icon('edit')),
      confirmButton({
        className: 'icon-btn danger',
        title: 'Delete session',
        idle: () => icon('trash'),
        armedLabel: 'Delete?',
        action: async () => {
          await deleteSession(s.id);
          toast('Session deleted');
          renderSessions();
        },
      }));
  }

  return el('div', { class: 'card' + (isRecovery ? ' special' : '') }, head, body);
}

function fillSessionTabs(body, s, isRecovery) {
  s.windows.forEach((w, wi) => {
    if (s.windows.length > 1) body.append(el('div', { class: 'group' }, `Window ${wi + 1}`, el('span', {}, String(w.tabs.length))));
    w.tabs.forEach((t, ti) => {
      body.append(el('div', { class: 'row', title: t.url, onclick: () => chrome.tabs.create({ url: t.url }) },
        el('img', { class: 'fav', src: favicon(t.url), alt: '' }),
        el('div', { class: 'text' }, el('div', { class: 'title' }, t.title)),
        !isRecovery && el('button', {
          type: 'button',
          class: 'icon-btn reveal',
          title: 'Remove from session',
          onclick: async (e) => {
            e.stopPropagation();
            await updateSession(s.id, (x) => x.windows[wi].tabs.splice(ti, 1));
            renderSessions();
          },
        }, icon('close'))));
    });
  });
}

function startRename(s, titleEl) {
  const input = el('input', { class: 'input rename', type: 'text', value: s.name, maxlength: 100 });
  titleEl.replaceWith(input);
  input.addEventListener('click', (e) => e.stopPropagation());
  input.focus();
  input.select();
  let done = false;
  const finish = async (save) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (save && name && name !== s.name) await updateSession(s.id, (x) => { x.name = name; });
    renderSessions();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

async function save(allWindows) {
  const windowId = allWindows ? null : (await chrome.windows.getCurrent()).id;
  const closeAfter = $('#closeAfter').checked;
  try {
    const session = await saveSession($('#sessionName').value.trim(), windowId);
    $('#sessionName').value = '';
    toast(`Saved ${plural(countTabs(session), 'tab')}`);
    await renderSessions();
    if (closeAfter) chrome.runtime.sendMessage({ type: 'close-saved', windowId });
  } catch (err) {
    toast(err.message);
  }
}

$('#saveWindow').addEventListener('click', () => save(false));
$('#saveAll').addEventListener('click', () => save(true));
$('#sessionName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') save(false);
});
$('#closeAfter').addEventListener('change', (e) => setSettings({ closeAfterSave: e.target.checked }));

show('tabs');

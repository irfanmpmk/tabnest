import { getSettings, setSettings, getSessions, setSessions, countTabs, sanitizeSession, parseUrlList } from './lib.js';
import { $, el, confirmButton, plural } from './ui.js';

// ---- Settings checkboxes ----

const settings = await getSettings();
for (const key of ['autosave', 'badge', 'closeAfterSave']) {
  const box = $(`#${key}`);
  box.checked = settings[key];
  box.addEventListener('change', () => setSettings({ [key]: box.checked }));
}

// ---- Shortcuts ----

const commands = await chrome.commands.getAll();
const list = $('#shortcutList');
for (const c of commands) {
  const label = c.name === '_execute_action' ? 'Open TabNest' : c.description;
  list.append(el('span', {}, label), c.shortcut ? el('kbd', {}, c.shortcut) : el('span', { class: 'sub' }, 'Not set'));
}
$('#editShortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

// ---- Backup ----

function setStatus(id, message, isError = false) {
  const s = $(id);
  s.textContent = message;
  s.classList.toggle('error', isError);
}

async function renderStats() {
  const sessions = await getSessions();
  const tabs = sessions.reduce((n, s) => n + countTabs(s), 0);
  $('#stats').textContent = sessions.length
    ? `You have ${plural(sessions.length, 'saved session')} with ${plural(tabs, 'tab')}.`
    : 'You have no saved sessions yet.';
}

async function addSessions(incoming) {
  const existing = await getSessions();
  const ids = new Set(existing.map((s) => s.id));
  const added = incoming.filter((s) => !ids.has(s.id));
  await setSessions([...added, ...existing]);
  await renderStats();
  return added.length;
}

$('#export').addEventListener('click', async () => {
  const sessions = await getSessions();
  const data = { app: 'TabNest', format: 1, exported: new Date().toISOString(), sessions };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  el('a', { href: url, download: `tabnest-sessions-${new Date().toISOString().slice(0, 10)}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  setStatus('#backupStatus', `Exported ${plural(sessions.length, 'session')}.`);
});

$('#importJson').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const raw = Array.isArray(parsed) ? parsed : parsed?.sessions;
    if (!Array.isArray(raw)) throw new Error('This file is not a TabNest export.');
    const clean = raw.map(sanitizeSession).filter(Boolean);
    const added = await addSessions(clean);
    setStatus('#backupStatus', `Imported ${plural(added, 'session')}${added < clean.length ? ' (skipped ones you already had)' : ''}.`);
  } catch (err) {
    setStatus('#backupStatus', err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message, true);
  }
});

$('#importList').addEventListener('click', async () => {
  const sessions = parseUrlList($('#urlList').value);
  if (!sessions.length) {
    setStatus('#listStatus', 'No valid links found. Each line should start with http:// or https://.', true);
    return;
  }
  await addSessions(sessions);
  $('#urlList').value = '';
  const tabs = sessions.reduce((n, s) => n + countTabs(s), 0);
  setStatus('#listStatus', `Imported ${plural(tabs, 'link')} into ${plural(sessions.length, 'session')}.`);
});

// ---- Delete everything ----

$('#deleteSlot').append(confirmButton({
  className: 'btn danger',
  title: 'Delete all saved sessions',
  idle: 'Delete all sessions',
  armedLabel: 'Click again to delete everything',
  action: async () => {
    await chrome.storage.local.remove(['sessions', 'autosave', 'lastSession']);
    await renderStats();
  },
}));

renderStats();

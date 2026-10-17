# TabNest: Tab Manager & Session Saver

A Manifest V3 Chrome extension. No build tools, no dependencies, no server.

## Features

- Search all open tabs (titles and URLs) across windows; press Enter to jump to the first match
- Close duplicate tabs, sort the current window by website, close tabs from the list
- Save the current window or all windows as named sessions; optionally close the saved tabs
- Restore sessions into new windows, open single tabs, rename, and remove tabs from a session
- Auto-saved "Previous browsing session" for recovery after a crash or restart
- Export/import JSON backups; import from OneTab or a plain list of links
- Tab count badge, keyboard shortcuts (Alt+Shift+K open, Alt+Shift+S save all), light and dark mode

## Folder layout

```
extension/   the extension itself (this folder is what gets zipped)
  manifest.json
  background.js   service worker: badge, auto-save, restore, shortcut
  lib.js          shared storage / session logic
  popup.*         toolbar popup (Tabs + Sessions views)
  options.*       settings, backup, import
  ui.js, styles.css
  icons/
store/       listing text, privacy policy, screenshots, promo tile
tools/       make-images.ps1: regenerates icons and promo tile
build.ps1    creates dist/tabnest-<version>.zip for upload
```

## Try it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `extension` folder.
4. Pin TabNest from the puzzle-piece menu, then click its icon.

After you edit a file, click the reload icon on the TabNest card in `chrome://extensions`.
To see background errors, click **service worker** on that card.

## Build the upload zip

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

This creates `dist\tabnest-<version>.zip`. Raise `version` in `manifest.json` before uploading each update.

## Publish to the Chrome Web Store

1. **Developer account:** go to https://chrome.google.com/webstore/devconsole, sign in, pay the one-time $5 fee and complete the account and email verification.
2. **Host the privacy policy:** it must be at a public URL. The easiest option is a public GitHub Gist (paste `store/PRIVACY_POLICY.md`) or a free Google Sites page.
3. **New item:** in the developer console, click **New item** and upload the zip from `dist`.
4. **Fill in the tabs** using `store/STORE_LISTING.md`:
   - Store listing: description, category, icon, screenshots, promo tile
   - Privacy practices: single purpose, permission justifications, data usage, privacy policy URL
   - Distribution: free, public, all regions
5. Click **Submit for review**. Review typically takes a few days. You get an email when it's published.

## Before you submit: manual test checklist

- [ ] Search finds tabs across two windows; Enter jumps to the first result
- [ ] "Close duplicates" closes extra copies but keeps the active/pinned one
- [ ] "Sort by site" groups tabs by domain and leaves pinned tabs first
- [ ] Save this window / Save all windows; the toast shows the tab count
- [ ] With "Close tabs after saving" ticked, saved tabs close and a new tab opens
- [ ] Restore opens the session in a new window with pinned tabs pinned
- [ ] Rename (Enter saves, click away saves), delete needs a second click
- [ ] Restart Chrome: "Previous browsing session" shows the tabs from before
- [ ] Alt+Shift+S flashes "OK" on the icon and adds a session
- [ ] Export then import on the Settings page; OneTab text import works
- [ ] Turning off the badge setting clears the number on the icon

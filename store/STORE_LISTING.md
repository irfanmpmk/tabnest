# Chrome Web Store listing: copy and paste

## Store listing tab

**Name** (from manifest): TabNest - Tab Manager & Session Saver

**Summary** (from manifest, max 132 chars):
Search tabs, close duplicates, and save sessions to restore anytime. 100% private: your data never leaves your device.

**Category:** Workflow & Planning (or Tools)

**Language:** English

**Description:**

```
Too many tabs? TabNest helps you find, clean up and save them, without sending your data anywhere.

FIND ANY TAB INSTANTLY
• Search titles and URLs across every open window
• Press Enter to jump straight to the first match
• See all windows and tab counts at a glance

CLEAN UP IN ONE CLICK
• Close duplicate tabs across all windows
• Sort the current window's tabs by website
• Close tabs right from the list

SAVE SESSIONS, RESTORE LATER
• Save the current window or all windows as a named session
• Optionally close saved tabs to free up memory (pinned tabs stay open)
• Restore a whole session, or open just one tab from it
• Rename sessions and remove tabs you no longer need

CRASH & RESTART RECOVERY
• TabNest keeps an auto-saved copy of your open tabs
• If Chrome crashes or restarts with a blank window, restore your previous session in one click

BACKUP & IMPORT
• Export all sessions to a JSON file and import them on another computer
• Import from OneTab or from any plain list of links

KEYBOARD SHORTCUTS
• Alt+Shift+K: open TabNest
• Alt+Shift+S: save all windows as a session
(Change them at chrome://extensions/shortcuts)

PRIVATE BY DESIGN
• No account, no servers, no analytics, no ads
• Your tabs and sessions are stored only in your browser
• Light and dark mode
```

**Graphic assets** (all in this `store` folder):
- Store icon: `../extension/icons/icon128.png`
- Screenshots (1280x800): `screenshot-1-tabs.png`, `screenshot-2-sessions.png`, `screenshot-3-settings.png`
- Small promo tile (440x280): `promo-small-440x280.png`

**Privacy policy URL:** host `PRIVACY_POLICY.md` publicly (see README) and paste the link.

---

## Privacy practices tab

**Single purpose:**
```
TabNest helps users manage their open browser tabs: search and switch between tabs, close duplicates, and save groups of tabs as sessions that can be restored later.
```

**Permission justifications:**

`tabs`:
```
Needed to read the titles and URLs of open tabs so the user can search them, find duplicates, sort them, and save them as sessions. It is also used to open saved tabs when a session is restored. Tab data is stored only locally and is never transmitted.
```

`storage`:
```
Stores the user's saved sessions, the auto-saved recovery copy of open tabs, and settings in chrome.storage.local on the user's device.
```

`favicon`:
```
Shows each website's icon next to tabs in the list, using Chrome's local favicon cache so that no requests are made to the websites themselves.
```

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Web history** (tab URLs and titles are read and stored locally). Do not tick anything else.

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

---

## Distribution tab

- Payments: Free
- Visibility: Public
- Regions: All regions

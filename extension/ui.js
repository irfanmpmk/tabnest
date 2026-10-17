// Small DOM helpers. Text is always set with textContent / append, never
// innerHTML, so page titles from websites can't inject markup.

export const $ = (selector) => document.querySelector(selector);

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  chevron: 'M9 6l6 6-6 6',
  settings: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
};

export function icon(name) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

// A button that needs a second click within 3 seconds to run its action.
export function confirmButton({ className, title, idle, armedLabel, action }) {
  let armed = false;
  let timer;
  const reset = () => {
    armed = false;
    button.classList.remove('armed');
    button.replaceChildren(typeof idle === 'string' ? idle : idle());
  };
  const button = el('button', {
    type: 'button',
    class: className,
    title,
    onclick: async (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        button.classList.add('armed');
        button.textContent = armedLabel;
        timer = setTimeout(reset, 3000);
        return;
      }
      clearTimeout(timer);
      await action();
      reset();
    },
  });
  reset();
  return button;
}

export function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

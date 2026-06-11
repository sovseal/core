/**
 * DOM helpers for reading/writing the prompt composer across very different
 * editors (plain <textarea>, ProseMirror, Quill, generic contenteditable).
 *
 * Writing into React/ProseMirror-controlled inputs is the tricky part: a bare
 * `value =` or `textContent =` won't notify the framework. We use the native
 * value setter + an `input` event for form fields, and `execCommand` /
 * `beforeinput` for contenteditable, which the major editors honor.
 */

export function isVisible(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function isField(el: Element): el is HTMLTextAreaElement | HTMLInputElement {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}

/** First visible match across the ordered selectors, then a generic fallback. */
export function findComposer(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (isVisible(el)) return el;
    }
  }
  for (const el of Array.from(
    document.querySelectorAll("textarea, [contenteditable='true']"),
  )) {
    if (isVisible(el)) return el;
  }
  return null;
}

export function readComposer(el: HTMLElement): string {
  if (isField(el)) return el.value;
  return el.innerText;
}

export function setComposer(el: HTMLElement, text: string): void {
  el.focus();
  if (isField(el)) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  // contenteditable: select-all then insert so frameworks see a real edit.
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

/** Prepend `text` ahead of whatever the user has already typed. */
export function prependComposer(el: HTMLElement, text: string): void {
  const current = readComposer(el).trim();
  setComposer(el, current ? `${text}\n\n${current}` : text);
}

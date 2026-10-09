/**
 * Copy-to-clipboard utility.
 *
 * Uses the async Clipboard API (`navigator.clipboard.writeText`) when
 * available, falling back to a legacy `execCommand('copy')` approach for
 * older browsers and insecure (non-HTTPS) contexts where the async API is
 * unavailable.
 *
 * Returns `true` on success, `false` on failure - callers can show feedback
 * accordingly.
 */

/**
 * Copy the given text to the system clipboard.
 *
 * @param text  The text to copy.
 * @returns `true` if the copy succeeded, `false` otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (text == null) return false;

  // Preferred: async Clipboard API (requires secure context in most browsers).
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy approach (e.g. user denied permission, or
      // the call failed in a non-secure context).
    }
  }

  // Legacy fallback: hidden textarea + execCommand('copy').
  try {
    return legacyCopy(text);
  } catch {
    return false;
  }
}

/**
 * Legacy copy via a temporary textarea element and `document.execCommand`.
 * Works in older browsers and non-secure contexts, but may fail if the
 * document is not focused.
 */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Move off-screen so it's invisible but still selectable.
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  // Save the current selection to restore after copying.
  const selected = document.getSelection();
  const range = selected && selected.rangeCount > 0 ? selected.getRangeAt(0) : null;

  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  document.body.removeChild(textarea);

  // Restore the previous selection.
  if (range && selected) {
    selected.removeAllRanges();
    selected.addRange(range);
  }

  return ok;
}

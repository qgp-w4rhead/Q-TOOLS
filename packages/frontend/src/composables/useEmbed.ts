/**
 * useEmbed — PostMessage protocol composable for iframe embed mode.
 *
 * Tools call this composable to participate in the embed PostMessage protocol:
 *   - Detect whether the tool is running inside an iframe (embed mode).
 *   - Listen for `input` messages from the parent page and deliver them via a
 *     callback or reactive ref.
 *   - Send `output` messages to the parent when the tool's result changes.
 *   - Automatically send `resize` messages when the tool's DOM height changes
 *     (via ResizeObserver), so the parent can resize the iframe to fit.
 *
 * Messages with a `source` other than `'Q-Tools-parent'` are ignored, making
 * the protocol safe to use alongside other PostMessage traffic on the page.
 *
 * The composable is a no-op when not in embed mode (standalone app usage) —
 * callbacks simply never fire and `sendOutput` does nothing.
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue';
import {
  isParentToToolMessage,
  type EmbedInputPayload,
  type EmbedOutputPayload,
} from '@q-tools/shared';

export interface UseEmbedOptions {
  /**
   * The root element to observe for height changes. Can be a template ref
   * (Ref<HTMLElement | null>) or a direct HTMLElement. Defaults to
   * `document.body` when omitted.
   */
  target?: Ref<HTMLElement | null> | HTMLElement | null;
  /**
   * Callback invoked when the parent sends an `input` message. The payload is
   * tool-specific (a record of input field values).
   */
  onInput?: (payload: EmbedInputPayload) => void;
  /**
   * When true, a ResizeObserver automatically sends `resize` messages to the
   * parent whenever the target element's height changes. Defaults to `true`.
   */
  autoResize?: boolean;
}

export interface UseEmbedReturn {
  /** `true` when the tool is running inside an iframe (embed mode). */
  isEmbed: Ref<boolean>;
  /** The latest `input` payload received from the parent (or `null`). */
  input: Ref<EmbedInputPayload | null>;
  /** Send an `output` message to the parent. No-op when not in embed mode. */
  sendOutput: (payload: EmbedOutputPayload) => void;
  /** Manually send a `resize` message to the parent. No-op when not in embed mode. */
  sendResize: (height: number, width?: number) => void;
}

/** Source tag for messages sent from the tool to the parent. */
const TOOL_SOURCE = 'Q-Tools-embed' as const;

/** Detect whether the current window is inside an iframe. */
function detectEmbed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top throws — we are definitely framed.
    return true;
  }
}

/** Resolve a Ref<HTMLElement|null> | HTMLElement | null to an HTMLElement. */
function resolveTarget(
  target: Ref<HTMLElement | null> | HTMLElement | null | undefined,
): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) return target;
  // It's a ref — read its .value.
  if ('value' in target) return (target as Ref<HTMLElement | null>).value;
  return null;
}

export function useEmbed(options: UseEmbedOptions = {}): UseEmbedReturn {
  const { onInput, autoResize = true } = options;
  const isEmbed = ref(detectEmbed());
  const input = ref<EmbedInputPayload | null>(null);

  // ResizeObserver instance — kept in a shallowRef so we can disconnect later.
  const observer = shallowRef<ResizeObserver | null>(null);

  function sendOutput(payload: EmbedOutputPayload): void {
    if (!isEmbed.value) return;
    window.parent.postMessage(
      { source: TOOL_SOURCE, type: 'output', payload },
      '*',
    );
  }

  function sendResize(height: number, width?: number): void {
    if (!isEmbed.value) return;
    const payload: { height: number; width?: number } = { height };
    if (width !== undefined) payload.width = width;
    window.parent.postMessage(
      { source: TOOL_SOURCE, type: 'resize', payload },
      '*',
    );
  }

  function handleMessage(event: MessageEvent): void {
    // Accept messages from any origin — the source tag is the protocol guard.
    if (!isParentToToolMessage(event.data)) return;
    input.value = event.data.payload;
    onInput?.(event.data.payload);
  }

  function startObserver(): void {
    if (!autoResize || !isEmbed.value) return;
    const el = resolveTarget(options.target) ?? document.body;
    if (!el || typeof ResizeObserver === 'undefined') return;

    observer.value = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const height = Math.ceil(entry.contentRect.height);
      if (height > 0) sendResize(height);
    });
    observer.value.observe(el);
    // Send an initial resize so the parent sizes correctly on load.
    sendResize(Math.ceil(el.getBoundingClientRect().height));
  }

  function stopObserver(): void {
    observer.value?.disconnect();
    observer.value = null;
  }

  onMounted(() => {
    window.addEventListener('message', handleMessage);
    startObserver();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage);
    stopObserver();
  });

  return { isEmbed, input, sendOutput, sendResize };
}

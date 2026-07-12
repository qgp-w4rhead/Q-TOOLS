/**
 * PostMessage protocol types for iframe embed mode.
 *
 * When a Q-Tools tool is embedded in an iframe (via `/embed/tools/:slug` or
 * the `embed.js` script), the parent page and the tool communicate using
 * `window.postMessage`. This file defines the message envelopes exchanged
 * between the two sides.
 *
 * Protocol:
 *   Parent → Tool:  { source: 'Q-Tools-parent', type: 'input',  payload: {...} }
 *   Tool → Parent:  { source: 'Q-Tools-embed',  type: 'output', payload: {...} }
 *   Tool → Parent:  { source: 'Q-Tools-embed',  type: 'resize', payload: { height: N } }
 *
 * Messages with any other `source` value are ignored by both sides, so the
 * protocol is safe to use alongside other PostMessage traffic on the page.
 */

/** Identifies which side sent the message. */
export type EmbedSource = 'Q-Tools-parent' | 'Q-Tools-embed';

/** Message types exchanged in the embed protocol. */
export type EmbedMessageType = 'input' | 'output' | 'resize';

/** Payload sent by the parent to pre-fill the tool's input. */
export interface EmbedInputPayload {
  /** Tool-specific input fields (shape defined per tool). */
  [key: string]: unknown;
}

/** Payload sent by the tool when its computed output changes. */
export interface EmbedOutputPayload {
  /** Tool-specific output fields (shape defined per tool). */
  [key: string]: unknown;
}

/** Payload sent by the tool to request a height change of the iframe. */
export interface EmbedResizePayload {
  /** Required content height in CSS pixels. */
  height: number;
  /** Optional content width in CSS pixels (rarely needed). */
  width?: number;
}

/** Union of all payload types keyed by message type. */
export type EmbedPayload = EmbedInputPayload | EmbedOutputPayload | EmbedResizePayload;

/** Envelope for a message sent from the parent to the embedded tool. */
export interface ParentToToolMessage<T extends EmbedInputPayload = EmbedInputPayload> {
  source: 'Q-Tools-parent';
  type: 'input';
  payload: T;
}

/** Envelope for a message sent from the embedded tool to the parent. */
export type ToolToParentMessage =
  | { source: 'Q-Tools-embed'; type: 'output'; payload: EmbedOutputPayload }
  | { source: 'Q-Tools-embed'; type: 'resize'; payload: EmbedResizePayload };

/** Any message in the embed protocol (either direction). */
export type EmbedMessage = ParentToToolMessage | ToolToParentMessage;

/** Type guard: is this a valid Q-Tools embed message from the parent? */
export function isParentToToolMessage(data: unknown): data is ParentToToolMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).source === 'Q-Tools-parent' &&
    (data as Record<string, unknown>).type === 'input'
  );
}

/** Type guard: is this a valid Q-Tools embed message from the tool? */
export function isToolToParentMessage(data: unknown): data is ToolToParentMessage {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.source === 'Q-Tools-embed' &&
    (d.type === 'output' || d.type === 'resize')
  );
}

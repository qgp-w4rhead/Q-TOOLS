/*!
 * Q-Tools embed.js — iframe embed loader with PostMessage-based auto-resize.
 *
 * Provides three embed methods:
 *
 *   1. **Declarative** (auto-discovered on script load):
 *        <script src="https://domain/embed.js" data-tool="hash-text" async>
 *        The script replaces itself with an iframe pointing to
 *        /embed/tools/<tool>. Optional attributes:
 *          data-target="#selector"  — mount the iframe inside this element
 *                                      (default: replace the script tag)
 *          data-width="100%"        — iframe width (default 100%)
 *          data-height="auto"       — initial iframe height (default auto;
 *                                      overridden by resize messages)
 *          data-allow="clipboard"   — iframe `allow` attribute
 *          data-input='{"text":"hi"}' — initial input payload sent on load
 *
 *   2. **Programmatic** (JS API):
 *        const embed = QTools.embed('hash-text', containerEl, {
 *          input: { text: 'hello' },
 *          onOutput: (payload) => console.log(payload),
 *          allow: 'clipboard',
 *        });
 *        embed.setInput({ text: 'world' });
 *        embed.destroy();
 *
 *   3. **Direct iframe** (no embed.js needed):
 *        <iframe src="https://domain/embed/tools/hash-text" ...>
 *
 * The script listens for `resize` messages from the embedded tool and adjusts
 * the iframe height accordingly. It also relays `output` messages to the
 * `onOutput` callback (programmatic mode) or fires a `qtools:output` event on
 * the iframe element (declarative mode).
 *
 * Protocol messages (see @q-tools/shared types/embed.ts):
 *   Parent → Tool:  { source: 'Q-Tools-parent', type: 'input', payload: {...} }
 *   Tool → Parent:  { source: 'Q-Tools-embed',  type: 'output', payload: {...} }
 *   Tool → Parent:  { source: 'Q-Tools-embed',  type: 'resize', payload: { height } }
 */
(function () {
  'use strict';

  if (window.QTools && window.QTools.embed) return; // guard against double-load

  var PARENT_SOURCE = 'Q-Tools-parent';
  var EMBED_SOURCE = 'Q-Tools-embed';

  /** Resolve the base URL for the iframe src (origin of this script). */
  function resolveBaseUrl() {
    // Prefer the src of the currently executing script tag.
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.dataset && s.dataset.qtoolsBase) return s.dataset.qtoolsBase;
    }
    // Fall back to the current page origin.
    return window.location.origin;
  }

  var BASE_URL = resolveBaseUrl();

  /** Determine the origin of the embed iframe for postMessage targeting. */
  function embedOrigin() {
    if (BASE_URL && BASE_URL.indexOf('://') !== -1) {
      try {
        var u = new URL(BASE_URL);
        return u.origin;
      } catch (e) {
        /* ignore */
      }
    }
    return window.location.origin;
  }

  /** Is this a valid Q-Tools message from the embedded tool? */
  function isToolMessage(data) {
    return (
      data &&
      typeof data === 'object' &&
      data.source === EMBED_SOURCE &&
      (data.type === 'output' || data.type === 'resize')
    );
  }

  /** Create the iframe element for a given tool slug. */
  function createIframe(slug, options) {
    options = options || {};
    var iframe = document.createElement('iframe');
    iframe.setAttribute('src', BASE_URL + '/embed/tools/' + encodeURIComponent(slug));
    iframe.setAttribute('width', options.width || '100%');
    iframe.setAttribute('height', options.height || 'auto');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || 'auto';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.className = 'qtools-embed';
    iframe.title = 'Q-Tools: ' + slug;
    if (options.allow) iframe.setAttribute('allow', options.allow);
    return iframe;
  }

  /**
   * Embed a tool inside a container element.
   * @param {string} slug  Tool slug (e.g. "hash-text").
   * @param {HTMLElement} container  Element to mount the iframe in.
   * @param {object} [options]
   * @param {object} [options.input]  Initial input payload sent on load.
   * @param {function} [options.onOutput]  Callback for output messages.
   * @param {string} [options.width]  iframe width (default "100%").
   * @param {string} [options.height] iframe height (default "auto").
   * @param {string} [options.allow]  iframe `allow` attribute.
   * @returns {object} embed handle with setInput() and destroy() methods.
   */
  function embed(slug, container, options) {
    options = options || {};
    if (!slug || !container) throw new Error('QTools.embed: slug and container are required');

    var iframe = createIframe(slug, options);
    container.appendChild(iframe);

    var origin = embedOrigin();
    var destroyed = false;

    // Send the initial input payload once the iframe has loaded.
    if (options.input) {
      iframe.addEventListener('load', function () {
        sendInput(options.input);
      });
    }

    function sendInput(payload) {
      if (destroyed || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { source: PARENT_SOURCE, type: 'input', payload: payload },
        origin
      );
    }

    function onMessage(event) {
      if (destroyed) return;
      // Accept from the embed origin or '*' (some setups serve from a CDN).
      if (event.source !== iframe.contentWindow) return;
      if (!isToolMessage(event.data)) return;

      if (event.data.type === 'resize') {
        var h = event.data.payload && event.data.payload.height;
        if (typeof h === 'number' && h > 0) {
          iframe.style.height = h + 'px';
          iframe.setAttribute('height', String(h));
        }
      } else if (event.data.type === 'output') {
        if (typeof options.onOutput === 'function') {
          options.onOutput(event.data.payload);
        }
        // Also fire a DOM event for declarative consumers.
        var evt;
        try {
          evt = new CustomEvent('qtools:output', { detail: event.data.payload });
        } catch (e) {
          evt = document.createEvent('CustomEvent');
          evt.initCustomEvent('qtools:output', false, false, event.data.payload);
        }
        iframe.dispatchEvent(evt);
      }
    }

    window.addEventListener('message', onMessage);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('message', onMessage);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }

    return {
      iframe: iframe,
      setInput: sendInput,
      destroy: destroy,
    };
  }

  /** Auto-discover declarative <script data-tool="..."> tags. */
  function autoDiscover() {
    var scripts = document.querySelectorAll('script[data-tool]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.dataset.qtoolsInitialized) continue;
      s.dataset.qtoolsInitialized = '1';

      var slug = s.dataset.tool;
      var targetSelector = s.dataset.target;
      var container = targetSelector
        ? document.querySelector(targetSelector)
        : null;
      // Default: replace the script tag with the iframe (insert container div).
      if (!container) {
        container = document.createElement('div');
        container.className = 'qtools-embed-container';
        if (s.parentNode) s.parentNode.replaceChild(container, s);
        else continue;
      }

      var input = null;
      if (s.dataset.input) {
        try {
          input = JSON.parse(s.dataset.input);
        } catch (e) {
          /* ignore malformed input */
        }
      }

      embed(slug, container, {
        input: input,
        width: s.dataset.width,
        height: s.dataset.height,
        allow: s.dataset.allow,
      });
    }
  }

  // Public API.
  window.QTools = window.QTools || {};
  window.QTools.embed = embed;
  window.QTools.BASE_URL = BASE_URL;

  // Auto-discover declarative embeds on DOMContentLoaded (or immediately if
  // the document is already ready).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoDiscover);
  } else {
    autoDiscover();
  }
})();

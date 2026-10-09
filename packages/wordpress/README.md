# Q-Tools Embed - WordPress Plugin

Embed any [Q-Tools](https://github.com/cognition-ai/q-tools) developer utility
in WordPress posts and pages via the `[q_tools]` shortcode. The plugin
enqueues the Q-Tools `embed.js` loader and renders a chromeless iframe that
participates in the PostMessage protocol (auto-resize, input/output relay).

## Requirements

- WordPress 5.5 or newer
- PHP 7.4 or newer
- A deployed Q-Tools instance (the iframe origin). See the main project README
  for deployment instructions.

## Installation

### Manual (zip upload)

1. Zip this `packages/wordpress/` directory so that `Q-Tools-embed.php` is at
   the archive root:
   ```bash
   cd packages/wordpress
   zip -r q-tools-embed.zip Q-Tools-embed.php README.md
   ```
2. In WordPress admin, go to **Plugins → Add New → Upload Plugin**.
3. Upload `q-tools-embed.zip` and click **Install Now**, then **Activate**.

### Manual (FTP / file manager)

1. Copy the `Q-Tools-embed.php` file to `wp-content/plugins/q-tools-embed/`.
2. In WordPress admin, go to **Plugins** and activate **Q-Tools Embed**.

### Composer (Bedrock / WPackagist)

Not yet published - use the manual method for now.

## Configuration

After activation, go to **Settings → Q-Tools Embed** and set the **Q-Tools Base
URL** to the origin of your deployed Q-Tools instance (e.g.
`https://q-tools.example.com`). The `embed.js` script and the iframe `src` are
resolved against this URL.

Alternatively, define the base URL in `wp-config.php` (takes priority over the
database option):

```php
define( 'QTOOLS_BASE_URL', 'https://q-tools.example.com' );
```

## Usage

Add the shortcode to any post or page:

```
[q_tools tool="hash-text"]
```

### Shortcode attributes

| Attribute | Required | Default  | Description                                                          |
| --------- | -------- | -------- | -------------------------------------------------------------------- |
| `tool`    | yes      | -        | Tool slug (e.g. `hash-text`, `uuid-generator`, `qr-code-generator`). |
| `input`   | no       | -        | JSON-encoded initial input payload sent to the tool on load.         |
| `width`   | no       | `100%`   | iframe width (CSS value).                                            |
| `height`  | no       | `auto`   | iframe height - overridden by resize messages from the tool.         |
| `allow`   | no       | auto     | iframe `allow` attribute (Permissions Policy). See table below.      |
| `target`  | no       | auto     | CSS selector for a custom mount element (default: generated div).    |

### Examples

Basic embed:

```
[q_tools tool="hash-text"]
```

With initial input and custom size:

```
[q_tools tool="hash-text" input='{"text":"hello world"}' width="100%" height="auto"]
```

Camera tool (explicit permissions):

```
[q_tools tool="camera-recorder" allow="camera; microphone"]
```

## Iframe requirements (Permissions Policy)

Most Q-Tools tools work in an iframe with no special permissions. A small
number of tools require additional `allow` attributes to access privileged
browser APIs. **When you omit the `allow` attribute, the plugin (via
`embed.js`) auto-applies the correct Permissions Policy based on the tool
slug.** You only need to set `allow` explicitly if you want to override the
default.

| Tool slug                | Required `allow`        | Reason                                              |
| ------------------------ | ----------------------- | --------------------------------------------------- |
| `camera-recorder`        | `camera; microphone`    | Accesses `getUserMedia` for webcam recording.       |
| `html-wysiwyg-editor`    | `clipboard-write`       | Copy buttons use the async Clipboard API.           |
| _(all other tools)_      | _(none)_                | No special permissions required.                    |

> **Note:** Many other tools also use the Clipboard API for their copy
> buttons, but they degrade gracefully (falling back to `document.execCommand`
> or a manual-copy prompt) when `clipboard-write` is not granted. Only the
> WYSIWYG editor declares it as a hard requirement.

### Direct iframe (without the shortcode)

If you prefer not to use the shortcode, you can embed a tool directly:

```html
<iframe
  src="https://q-tools.example.com/embed/tools/hash-text"
  width="100%"
  height="400"
  frameborder="0"
  scrolling="no"
  allow="clipboard-write"
  title="Q-Tools: hash-text"
></iframe>
```

For tools with no special requirements, omit the `allow` attribute.

## Programmatic JS API

`embed.js` exposes a global `QTools` object with three methods:

### `QTools.embed(slug, container, options)`

Mount a tool iframe inside a container element. Returns a handle with
`setInput(payload)` and `destroy()` methods.

```js
const handle = QTools.embed('hash-text', document.getElementById('mount'), {
  input: { text: 'hello' },
  onOutput: (payload) => console.log('output:', payload),
});
handle.setInput({ text: 'world' });
handle.destroy();
```

### `QTools.getOutput(slug, input, options)`

Headless one-shot computation: creates a hidden iframe, sends the input, and
resolves with the first output payload. Useful for pipelines that need a
tool's result without a visible UI.

```js
const output = await QTools.getOutput('hash-text', { text: 'abc' });
console.log(output.sha256);
```

Options:

| Option    | Default | Description                                            |
| --------- | ------- | ------------------------------------------------------ |
| `timeout` | `10000` | Reject after N ms with no output (0 = no timeout).     |
| `allow`   | auto    | iframe `allow` attribute (Permissions Policy).         |

### `QTools.resolveAllow(slug, explicit)`

Resolve the `allow` attribute for a tool slug (explicit value wins, otherwise
the built-in `TOOL_IFRAME_REQUIREMENTS` map is consulted). Exposed for
introspection/testing.

## PostMessage protocol

The embedded tool and the parent page communicate via `window.postMessage`:

```
Parent → Tool:  { source: 'Q-Tools-parent', type: 'input',  payload: {...} }
Tool → Parent:  { source: 'Q-Tools-embed',  type: 'output', payload: {...} }
Tool → Parent:  { source: 'Q-Tools-embed',  type: 'resize', payload: { height: N } }
```

Messages with any other `source` value are ignored, so the protocol is safe to
use alongside other PostMessage traffic on the page.

## HTTP headers (embed routes)

The Q-Tools backend sets the following headers on `/embed/*` routes so the
chromeless views can be framed from any origin:

```
X-Frame-Options: ALLOWALL
Content-Security-Policy: frame-ancestors *
```

If you serve Q-Tools behind a reverse proxy (Nginx, Cloudflare, etc.), make
sure these headers are not stripped or overridden for `/embed/` paths.

## Changelog

### 1.0.0

- Initial release.
- `[q_tools]` shortcode with `tool`, `input`, `width`, `height`, `allow`,
  `target` attributes.
- Settings page for the Q-Tools Base URL (with `QTOOLS_BASE_URL` constant
  override).
- Enqueues `embed.js` with auto-discovery of declarative embeds.
- Auto-applies iframe `allow` attributes for tools that declare requirements.

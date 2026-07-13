/**
 * httpStatusDatabase — bundled HTTP status code reference (no external dep).
 *
 * Covers the IANA-registered status codes from the core HTTP specs
 * (RFC 9110, RFC 7231-7235, RFC 2518, RFC 6585, RFC 7725, RFC 8297,
 * RFC 7538, RFC 2295, RFC 2324, RFC 2774, RFC 3229, RFC 5842, RFC 7807)
 * plus widely-deployed unofficial codes used by Cloudflare, Nginx, IIS,
 * Twitter, Laravel, and AWS. Each entry carries a short description
 * suitable for a quick reference tool.
 *
 * The database is intentionally finite and human-curated — it favours
 * the most useful descriptions over exhaustive IANA prose.
 */

/** HTTP status category (the leading digit of the 3-digit code). */
export type HttpStatusCategory = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

/** A single HTTP status code entry. */
export interface HttpStatusEntry {
  /** The 3-digit numeric status code. */
  code: number;
  /** Short canonical name (e.g. "Not Found"). */
  name: string;
  /** One-sentence description of the code's meaning. */
  description: string;
  /** Category derived from the leading digit. */
  category: HttpStatusCategory;
  /** Whether the code is IANA-registered in an active RFC. */
  official: boolean;
}

/** Derive the category from a numeric code. */
export function categoryFromCode(code: number): HttpStatusCategory {
  const c = Math.floor(code / 100);
  switch (c) {
    case 1:
      return '1xx';
    case 2:
      return '2xx';
    case 3:
      return '3xx';
    case 4:
      return '4xx';
    case 5:
      return '5xx';
    default:
      // Defensive: codes outside 100-599 are still bucketed by leading digit.
      if (c === 0 || c < 1) return '1xx';
      return '5xx';
  }
}

/** Source-of-truth table. Order is stable for deterministic rendering. */
export const HTTP_STATUS_ENTRIES: readonly HttpStatusEntry[] = [
  /* ----------------------------- 1xx — Informational ----------------------------- */
  {
    code: 100,
    name: 'Continue',
    description: 'The client should continue with its request. Interim response sent before the final body.',
    category: '1xx',
    official: true,
  },
  {
    code: 101,
    name: 'Switching Protocols',
    description: 'The server agrees to switch protocols as requested by the client via the Upgrade header.',
    category: '1xx',
    official: true,
  },
  {
    code: 102,
    name: 'Processing',
    description: 'WebDAV: the server has received the request and is processing it, but no response is available yet.',
    category: '1xx',
    official: true,
  },
  {
    code: 103,
    name: 'Early Hints',
    description: 'Returned before the final response to allow the client to preload resources while the server prepares the response.',
    category: '1xx',
    official: true,
  },
  {
    code: 104,
    name: 'Not Modified (AWS)',
    description: 'Unofficial AWS CloudFront code used internally to indicate a cached not-modified response.',
    category: '1xx',
    official: false,
  },

  /* ----------------------------- 2xx — Success ----------------------------- */
  {
    code: 200,
    name: 'OK',
    description: 'Standard success response. The request has succeeded and the response body carries the result.',
    category: '2xx',
    official: true,
  },
  {
    code: 201,
    name: 'Created',
    description: 'The request has been fulfilled and a new resource has been created. Usually returned by POST/PUT.',
    category: '2xx',
    official: true,
  },
  {
    code: 202,
    name: 'Accepted',
    description: 'The request has been accepted for processing but the operation has not yet completed (asynchronous).',
    category: '2xx',
    official: true,
  },
  {
    code: 203,
    name: 'Non-Authoritative Information',
    description: 'The returned meta-information is from a local or third-party copy, not the origin server.',
    category: '2xx',
    official: true,
  },
  {
    code: 204,
    name: 'No Content',
    description: 'The server processed the request successfully but is not returning any body content.',
    category: '2xx',
    official: true,
  },
  {
    code: 205,
    name: 'Reset Content',
    description: 'The server asks the client to reset the originating document (e.g. clear a form).',
    category: '2xx',
    official: true,
  },
  {
    code: 206,
    name: 'Partial Content',
    description: 'The server is delivering only part of the resource due to a Range header. Used by download resumption.',
    category: '2xx',
    official: true,
  },
  {
    code: 207,
    name: 'Multi-Status',
    description: 'WebDAV: the response body is XML containing per-resource statuses for multiple operations.',
    category: '2xx',
    official: true,
  },
  {
    code: 208,
    name: 'Already Reported',
    description: 'WebDAV: members of a DAV binding have already been enumerated in a previous part of the response.',
    category: '2xx',
    official: true,
  },
  {
    code: 226,
    name: 'IM Used',
    description: 'The server has fulfilled a GET request with instance-manipulations applied (RFC 3229 delta encoding).',
    category: '2xx',
    official: true,
  },

  /* ----------------------------- 3xx — Redirection ----------------------------- */
  {
    code: 300,
    name: 'Multiple Choices',
    description: 'The resource has multiple representations; the client must choose one (links usually in the body).',
    category: '3xx',
    official: true,
  },
  {
    code: 301,
    name: 'Moved Permanently',
    description: 'The resource has been permanently moved to a new URI; future requests should use the new URI.',
    category: '3xx',
    official: true,
  },
  {
    code: 302,
    name: 'Found',
    description: 'The resource is temporarily under a different URI. Historically "Moved Temporarily".',
    category: '3xx',
    official: true,
  },
  {
    code: 303,
    name: 'See Other',
    description: 'The response to the request can be found at another URI via GET. Used for POST→redirect→GET pattern.',
    category: '3xx',
    official: true,
  },
  {
    code: 304,
    name: 'Not Modified',
    description: 'The resource has not been modified since the version specified by the request headers. No body sent.',
    category: '3xx',
    official: true,
  },
  {
    code: 305,
    name: 'Use Proxy',
    description: 'Deprecated: the requested resource must be accessed through the specified proxy.',
    category: '3xx',
    official: true,
  },
  {
    code: 307,
    name: 'Temporary Redirect',
    description: 'The resource is temporarily under a different URI; the request method must not change when redirecting.',
    category: '3xx',
    official: true,
  },
  {
    code: 308,
    name: 'Permanent Redirect',
    description: 'The resource has permanently moved; the request method must not change when redirecting.',
    category: '3xx',
    official: true,
  },

  /* ----------------------------- 4xx — Client Error ----------------------------- */
  {
    code: 400,
    name: 'Bad Request',
    description: 'The server cannot process the request due to malformed syntax or invalid parameters.',
    category: '4xx',
    official: true,
  },
  {
    code: 401,
    name: 'Unauthorized',
    description: 'Authentication is required and has not been provided or has failed. Send WWW-Authenticate header.',
    category: '4xx',
    official: true,
  },
  {
    code: 402,
    name: 'Payment Required',
    description: 'Reserved for future use. Intended for digital payment systems; rarely implemented.',
    category: '4xx',
    official: true,
  },
  {
    code: 403,
    name: 'Forbidden',
    description: 'The server understood the request but refuses to authorize it. Distinct from 401 (no auth) — this is auth denied.',
    category: '4xx',
    official: true,
  },
  {
    code: 404,
    name: 'Not Found',
    description: 'The server cannot find the requested resource. The most common client error on the web.',
    category: '4xx',
    official: true,
  },
  {
    code: 405,
    name: 'Method Not Allowed',
    description: 'The request method is known by the server but not supported for this resource (e.g. POST to a read-only URL).',
    category: '4xx',
    official: true,
  },
  {
    code: 406,
    name: 'Not Acceptable',
    description: 'The resource cannot generate a representation matching the Accept headers sent by the client.',
    category: '4xx',
    official: true,
  },
  {
    code: 407,
    name: 'Proxy Authentication Required',
    description: 'The client must authenticate itself with the proxy. Similar to 401 but for proxy servers.',
    category: '4xx',
    official: true,
  },
  {
    code: 408,
    name: 'Request Timeout',
    description: 'The server timed out waiting for the client to send the request body or complete the connection.',
    category: '4xx',
    official: true,
  },
  {
    code: 409,
    name: 'Conflict',
    description: 'The request conflicts with the current state of the resource (e.g. edit conflict on a versioned resource).',
    category: '4xx',
    official: true,
  },
  {
    code: 410,
    name: 'Gone',
    description: 'The resource is no longer available and no forwarding address is known. Permanent removal, unlike 404.',
    category: '4xx',
    official: true,
  },
  {
    code: 411,
    name: 'Length Required',
    description: 'The request requires a Content-Length header which was not provided.',
    category: '4xx',
    official: true,
  },
  {
    code: 412,
    name: 'Precondition Failed',
    description: 'A precondition specified in request headers (e.g. If-Match) evaluated to false.',
    category: '4xx',
    official: true,
  },
  {
    code: 413,
    name: 'Content Too Large',
    description: 'The request payload is larger than the server is willing or able to process. Formerly "Payload Too Large".',
    category: '4xx',
    official: true,
  },
  {
    code: 414,
    name: 'URI Too Long',
    description: 'The requested URI is longer than the server is willing to interpret. Often caused by GET form submissions.',
    category: '4xx',
    official: true,
  },
  {
    code: 415,
    name: 'Unsupported Media Type',
    description: 'The request has a media type (Content-Type) the server does not support for the operation.',
    category: '4xx',
    official: true,
  },
  {
    code: 416,
    name: 'Range Not Satisfiable',
    description: 'The Range header cannot be fulfilled because the requested byte range is outside the resource size.',
    category: '4xx',
    official: true,
  },
  {
    code: 417,
    name: 'Expectation Failed',
    description: 'The expectation given in the Expect header cannot be met by the server.',
    category: '4xx',
    official: true,
  },
  {
    code: 418,
    name: "I'm a teapot",
    description: 'RFC 2324 (HTCPCP) joke code. The server refuses to brew coffee because it is, permanently, a teapot.',
    category: '4xx',
    official: true,
  },
  {
    code: 421,
    name: 'Misdirected Request',
    description: 'The request was directed at a server that cannot produce a response (HTTP/2 connection reuse mismatch).',
    category: '4xx',
    official: true,
  },
  {
    code: 422,
    name: 'Unprocessable Content',
    description: 'The server understands the content type and syntax but cannot process the semantic content. Common in REST APIs.',
    category: '4xx',
    official: true,
  },
  {
    code: 423,
    name: 'Locked',
    description: 'WebDAV: the resource being accessed is locked.',
    category: '4xx',
    official: true,
  },
  {
    code: 424,
    name: 'Failed Dependency',
    description: 'WebDAV: the request failed because it depended on another request that failed.',
    category: '4xx',
    official: true,
  },
  {
    code: 425,
    name: 'Too Early',
    description: 'The server refuses to process a request that could be replayed (anti-replay protection for early data).',
    category: '4xx',
    official: true,
  },
  {
    code: 426,
    name: 'Upgrade Required',
    description: 'The client must upgrade to a different protocol (indicated by the Upgrade header) to use this resource.',
    category: '4xx',
    official: true,
  },
  {
    code: 428,
    name: 'Precondition Required',
    description: 'The server requires the request to be conditional (e.g. include If-Match) to avoid the lost-update problem.',
    category: '4xx',
    official: true,
  },
  {
    code: 429,
    name: 'Too Many Requests',
    description: 'The client has sent too many requests in a given time (rate limiting). Often paired with Retry-After.',
    category: '4xx',
    official: true,
  },
  {
    code: 431,
    name: 'Request Header Fields Too Large',
    description: 'The server cannot process the request because the combined header fields are too large.',
    category: '4xx',
    official: true,
  },
  {
    code: 451,
    name: 'Unavailable For Legal Reasons',
    description: 'The resource is unavailable due to legal demands (censorship, DMCA, government takedown). RFC 7725.',
    category: '4xx',
    official: true,
  },

  /* ----------------------------- 4xx — Unofficial / vendor ----------------------------- */
  {
    code: 419,
    name: 'Page Expired (Laravel)',
    description: 'Unofficial Laravel/Symfony code: the CSRF token has expired or is missing.',
    category: '4xx',
    official: false,
  },
  {
    code: 420,
    name: 'Enhance Your Calm (Twitter)',
    description: 'Unofficial Twitter code: the client is being rate limited. Returned by the legacy Twitter API.',
    category: '4xx',
    official: false,
  },
  {
    code: 440,
    name: 'Login Time-out (SAP)',
    description: 'Unofficial SAP code: the client session has expired and login is required again.',
    category: '4xx',
    official: false,
  },
  {
    code: 444,
    name: 'No Response (Nginx)',
    description: 'Unofficial Nginx code: the server returns no information and closes the connection. Used to drop malicious clients.',
    category: '4xx',
    official: false,
  },
  {
    code: 449,
    name: 'Retry With (Microsoft)',
    description: 'Unofficial IIS code: the request should be retried after performing the indicated action.',
    category: '4xx',
    official: false,
  },
  {
    code: 450,
    name: 'Blocked by Windows Parental Controls',
    description: 'Unofficial Microsoft code: the resource was blocked by parental controls on the client machine.',
    category: '4xx',
    official: false,
  },
  {
    code: 495,
    name: 'SSL Certificate Error (Nginx)',
    description: 'Unofficial Nginx code: client SSL certificate validation failed.',
    category: '4xx',
    official: false,
  },
  {
    code: 496,
    name: 'SSL Certificate Required (Nginx)',
    description: 'Unofficial Nginx code: client SSL certificate is required but not provided.',
    category: '4xx',
    official: false,
  },
  {
    code: 497,
    name: 'HTTP Request Sent to HTTPS Port (Nginx)',
    description: 'Unofficial Nginx code: a plain HTTP request was sent to a port expecting HTTPS.',
    category: '4xx',
    official: false,
  },
  {
    code: 498,
    name: 'Token Invalid/Expired (Esri)',
    description: 'Unofficial Esri/ArcGIS code: the access token is invalid or has expired.',
    category: '4xx',
    official: false,
  },
  {
    code: 499,
    name: 'Client Closed Request (Nginx)',
    description: 'Unofficial Nginx code: the client closed the connection before the server could send a response.',
    category: '4xx',
    official: false,
  },

  /* ----------------------------- 5xx — Server Error ----------------------------- */
  {
    code: 500,
    name: 'Internal Server Error',
    description: 'Generic server error. The server encountered an unexpected condition that prevented it from fulfilling the request.',
    category: '5xx',
    official: true,
  },
  {
    code: 501,
    name: 'Not Implemented',
    description: 'The server does not support the functionality required to fulfill the request (e.g. unknown HTTP method).',
    category: '5xx',
    official: true,
  },
  {
    code: 502,
    name: 'Bad Gateway',
    description: 'The server, acting as a gateway or proxy, received an invalid response from an upstream server.',
    category: '5xx',
    official: true,
  },
  {
    code: 503,
    name: 'Service Unavailable',
    description: 'The server is currently unavailable (overloaded or down for maintenance). Usually temporary.',
    category: '5xx',
    official: true,
  },
  {
    code: 504,
    name: 'Gateway Timeout',
    description: 'The server, acting as a gateway or proxy, did not receive a timely response from an upstream server.',
    category: '5xx',
    official: true,
  },
  {
    code: 505,
    name: 'HTTP Version Not Supported',
    description: 'The server does not support the HTTP protocol version used in the request.',
    category: '5xx',
    official: true,
  },
  {
    code: 506,
    name: 'Variant Also Negotiates',
    description: 'Transparent content negotiation for the request results in a circular reference.',
    category: '5xx',
    official: true,
  },
  {
    code: 507,
    name: 'Insufficient Storage',
    description: 'WebDAV: the server is unable to store the representation needed to complete the request.',
    category: '5xx',
    official: true,
  },
  {
    code: 508,
    name: 'Loop Detected',
    description: 'WebDAV: the server detected an infinite loop while processing the request.',
    category: '5xx',
    official: true,
  },
  {
    code: 510,
    name: 'Not Extended',
    description: 'Further extensions to the request are required for the server to fulfill it.',
    category: '5xx',
    official: true,
  },
  {
    code: 511,
    name: 'Network Authentication Required',
    description: 'The client must authenticate to gain network access (captive portals in hotels/airports).',
    category: '5xx',
    official: true,
  },

  /* ----------------------------- 5xx — Unofficial / Cloudflare ----------------------------- */
  {
    code: 520,
    name: 'Web Server Returned an Unknown Error (Cloudflare)',
    description: 'Unofficial Cloudflare code: the origin returned an empty, unknown, or unexpected response.',
    category: '5xx',
    official: false,
  },
  {
    code: 521,
    name: 'Web Server Is Down (Cloudflare)',
    description: 'Unofficial Cloudflare code: the origin server refused the connection from Cloudflare.',
    category: '5xx',
    official: false,
  },
  {
    code: 522,
    name: 'Connection Timed Out (Cloudflare)',
    description: 'Unofficial Cloudflare code: Cloudflare could not negotiate a TCP handshake with the origin server.',
    category: '5xx',
    official: false,
  },
  {
    code: 523,
    name: 'Origin Is Unreachable (Cloudflare)',
    description: 'Unofficial Cloudflare code: Cloudflare could not reach the origin server (routing or DNS issue).',
    category: '5xx',
    official: false,
  },
  {
    code: 524,
    name: 'A Timeout Occurred (Cloudflare)',
    description: 'Unofficial Cloudflare code: a TCP connection was established but the origin did not respond before the timeout.',
    category: '5xx',
    official: false,
  },
  {
    code: 525,
    name: 'SSL Handshake Failed (Cloudflare)',
    description: 'Unofficial Cloudflare code: the SSL handshake between Cloudflare and the origin server failed.',
    category: '5xx',
    official: false,
  },
  {
    code: 526,
    name: 'Invalid SSL Certificate (Cloudflare)',
    description: 'Unofficial Cloudflare code: the origin server presented an SSL certificate Cloudflare could not validate.',
    category: '5xx',
    official: false,
  },
  {
    code: 527,
    name: 'Railgun Error (Cloudflare)',
    description: 'Unofficial Cloudflare code: the Railgun listener connection between Cloudflare and the origin failed.',
    category: '5xx',
    official: false,
  },
  {
    code: 530,
    name: 'Origin DNS Error (Cloudflare)',
    description: 'Unofficial Cloudflare code: Cloudflare could not resolve the origin DNS or the origin returned a DNS error.',
    category: '5xx',
    official: false,
  },
  {
    code: 598,
    name: 'Network Read Timeout Error (proxy)',
    description: 'Unofficial proxy code: a read timeout occurred while the proxy was waiting for the upstream response.',
    category: '5xx',
    official: false,
  },
  {
    code: 599,
    name: 'Network Connect Timeout Error (proxy)',
    description: 'Unofficial proxy code: a connect timeout occurred while the proxy was establishing the upstream connection.',
    category: '5xx',
    official: false,
  },
];

/** Map of code → entry for O(1) lookup. */
export const HTTP_STATUS_BY_CODE: ReadonlyMap<number, HttpStatusEntry> = (() => {
  const m = new Map<number, HttpStatusEntry>();
  for (const e of HTTP_STATUS_ENTRIES) m.set(e.code, e);
  return m;
})();

/** All categories in stable order. */
export const HTTP_STATUS_CATEGORIES: readonly HttpStatusCategory[] = [
  '1xx',
  '2xx',
  '3xx',
  '4xx',
  '5xx',
];

/** Count of entries per category. */
export const HTTP_STATUS_COUNTS: Readonly<Record<HttpStatusCategory, number>> =
  (() => {
    const out: Record<HttpStatusCategory, number> = {
      '1xx': 0,
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
    };
    for (const e of HTTP_STATUS_ENTRIES) out[e.category] += 1;
    return out;
  })();

/** Total bytes of the bundled database (rough, for stats display). */
export const DATABASE_SIZE_BYTES = JSON.stringify(HTTP_STATUS_ENTRIES).length;

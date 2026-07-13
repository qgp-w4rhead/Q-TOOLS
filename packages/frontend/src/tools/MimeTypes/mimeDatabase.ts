/**
 * mimeDatabase — bundled MIME-type database (no external dependency).
 *
 * Two indexes are derived from a single source-of-truth table
 * (`MIME_ENTRIES`): an extension → primary MIME type map and a
 * MIME type → extensions[] map. The table covers ~300+ common types
 * spanning text, image, audio, video, application, font, archive,
 * document, code, and binary formats.
 *
 * The database is hand-curated from public references (IANA media-type
 * registry, Apache httpd `mime.types`, MDN). It is intentionally finite
 * and opinionated — it favours the most useful / most common type for
 * each extension rather than enumerating every rare vendor type.
 */

/**
 * A single entry in the MIME database.
 *
 * `ext` is the canonical lowercase extension (no leading dot).
 * `mime` is the canonical MIME type (lowercase).
 * `name` is a short human-readable label.
 * `category` groups the entry for filtering / colour-coding.
 */
export interface MimeEntry {
  ext: string;
  mime: string;
  name: string;
  category: MimeCategory;
}

export type MimeCategory =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'application'
  | 'font'
  | 'archive'
  | 'document'
  | 'code'
  | 'binary';

/** Source-of-truth table. Order is stable for deterministic rendering. */
export const MIME_ENTRIES: readonly MimeEntry[] = [
  /* ----------------------------- text ----------------------------- */
  { ext: 'txt', mime: 'text/plain', name: 'Plain text', category: 'text' },
  { ext: 'text', mime: 'text/plain', name: 'Plain text', category: 'text' },
  { ext: 'log', mime: 'text/plain', name: 'Log file', category: 'text' },
  { ext: 'csv', mime: 'text/csv', name: 'Comma-separated values', category: 'text' },
  { ext: 'tsv', mime: 'text/tab-separated-values', name: 'Tab-separated values', category: 'text' },
  { ext: 'html', mime: 'text/html', name: 'HTML document', category: 'text' },
  { ext: 'htm', mime: 'text/html', name: 'HTML document', category: 'text' },
  { ext: 'xhtml', mime: 'application/xhtml+xml', name: 'XHTML', category: 'text' },
  { ext: 'css', mime: 'text/css', name: 'CSS stylesheet', category: 'text' },
  { ext: 'xml', mime: 'application/xml', name: 'XML document', category: 'text' },
  { ext: 'xsl', mime: 'application/xml', name: 'XSL stylesheet', category: 'text' },
  { ext: 'xslt', mime: 'application/xslt+xml', name: 'XSLT', category: 'text' },
  { ext: 'yaml', mime: 'application/x-yaml', name: 'YAML', category: 'text' },
  { ext: 'yml', mime: 'application/x-yaml', name: 'YAML', category: 'text' },
  { ext: 'toml', mime: 'application/toml', name: 'TOML', category: 'text' },
  { ext: 'ini', mime: 'text/plain', name: 'INI config', category: 'text' },
  { ext: 'cfg', mime: 'text/plain', name: 'Config file', category: 'text' },
  { ext: 'conf', mime: 'text/plain', name: 'Config file', category: 'text' },
  { ext: 'rtf', mime: 'application/rtf', name: 'Rich text', category: 'text' },
  { ext: 'md', mime: 'text/markdown', name: 'Markdown', category: 'text' },
  { ext: 'markdown', mime: 'text/markdown', name: 'Markdown', category: 'text' },
  { ext: 'asc', mime: 'text/plain', name: 'ASCII text', category: 'text' },
  { ext: 'vcard', mime: 'text/vcard', name: 'vCard', category: 'text' },
  { ext: 'vcf', mime: 'text/vcard', name: 'vCard', category: 'text' },
  { ext: 'ics', mime: 'text/calendar', name: 'iCalendar', category: 'text' },
  { ext: 'ifb', mime: 'text/calendar', name: 'iCalendar', category: 'text' },
  { ext: 'curl', mime: 'text/vnd.curl', name: 'Curl script', category: 'text' },
  { ext: 'sgml', mime: 'text/sgml', name: 'SGML', category: 'text' },
  { ext: 'sgm', mime: 'text/sgml', name: 'SGML', category: 'text' },

  /* ----------------------------- image ---------------------------- */
  { ext: 'png', mime: 'image/png', name: 'PNG image', category: 'image' },
  { ext: 'jpg', mime: 'image/jpeg', name: 'JPEG image', category: 'image' },
  { ext: 'jpeg', mime: 'image/jpeg', name: 'JPEG image', category: 'image' },
  { ext: 'jpe', mime: 'image/jpeg', name: 'JPEG image', category: 'image' },
  { ext: 'jfif', mime: 'image/jpeg', name: 'JPEG image', category: 'image' },
  { ext: 'gif', mime: 'image/gif', name: 'GIF image', category: 'image' },
  { ext: 'webp', mime: 'image/webp', name: 'WebP image', category: 'image' },
  { ext: 'avif', mime: 'image/avif', name: 'AVIF image', category: 'image' },
  { ext: 'bmp', mime: 'image/bmp', name: 'Bitmap image', category: 'image' },
  { ext: 'dib', mime: 'image/bmp', name: 'Bitmap image', category: 'image' },
  { ext: 'svg', mime: 'image/svg+xml', name: 'SVG image', category: 'image' },
  { ext: 'svgz', mime: 'image/svg+xml', name: 'SVG image (compressed)', category: 'image' },
  { ext: 'ico', mime: 'image/x-icon', name: 'Icon', category: 'image' },
  { ext: 'cur', mime: 'image/x-icon', name: 'Cursor', category: 'image' },
  { ext: 'tif', mime: 'image/tiff', name: 'TIFF image', category: 'image' },
  { ext: 'tiff', mime: 'image/tiff', name: 'TIFF image', category: 'image' },
  { ext: 'psd', mime: 'image/vnd.adobe.photoshop', name: 'Photoshop', category: 'image' },
  { ext: 'raw', mime: 'image/raw', name: 'RAW image', category: 'image' },
  { ext: 'heic', mime: 'image/heic', name: 'HEIC image', category: 'image' },
  { ext: 'heif', mime: 'image/heif', name: 'HEIF image', category: 'image' },
  { ext: 'avifs', mime: 'image/avif-sequence', name: 'AVIF sequence', category: 'image' },
  { ext: 'tga', mime: 'image/x-tga', name: 'Targa image', category: 'image' },
  { ext: 'pcx', mime: 'image/x-pcx', name: 'PCX image', category: 'image' },
  { ext: 'ras', mime: 'image/x-cmu-raster', name: 'Sun raster', category: 'image' },
  { ext: 'rgb', mime: 'image/x-rgb', name: 'RGB image', category: 'image' },
  { ext: 'xbm', mime: 'image/x-xbitmap', name: 'X bitmap', category: 'image' },
  { ext: 'xpm', mime: 'image/x-xpixmap', name: 'X pixmap', category: 'image' },
  { ext: 'xwd', mime: 'image/x-xwindowdump', name: 'X window dump', category: 'image' },
  { ext: 'sgi', mime: 'image/sgi', name: 'SGI image', category: 'image' },
  { ext: 'jp2', mime: 'image/jp2', name: 'JPEG 2000', category: 'image' },
  { ext: 'j2k', mime: 'image/jp2', name: 'JPEG 2000', category: 'image' },
  { ext: 'jpx', mime: 'image/jpx', name: 'JPEG 2000', category: 'image' },
  { ext: 'wbmp', mime: 'image/vnd.wap.wbmp', name: 'WAP bitmap', category: 'image' },
  { ext: 'dds', mime: 'image/vnd.ms-dds', name: 'DirectDraw surface', category: 'image' },
  { ext: 'exr', mime: 'image/aces', name: 'OpenEXR', category: 'image' },
  { ext: 'fits', mime: 'image/fits', name: 'FITS image', category: 'image' },
  { ext: 'hdr', mime: 'image/vnd.radiance', name: 'Radiance HDR', category: 'image' },

  /* ----------------------------- audio ---------------------------- */
  { ext: 'mp3', mime: 'audio/mpeg', name: 'MP3 audio', category: 'audio' },
  { ext: 'mp2', mime: 'audio/mpeg', name: 'MP2 audio', category: 'audio' },
  { ext: 'mpga', mime: 'audio/mpeg', name: 'MPEG audio', category: 'audio' },
  { ext: 'm4a', mime: 'audio/mp4', name: 'M4A audio', category: 'audio' },
  { ext: 'm4b', mime: 'audio/mp4', name: 'M4B audiobook', category: 'audio' },
  { ext: 'm4p', mime: 'audio/mp4', name: 'M4P audio', category: 'audio' },
  { ext: 'aac', mime: 'audio/aac', name: 'AAC audio', category: 'audio' },
  { ext: 'ogg', mime: 'audio/ogg', name: 'Ogg audio', category: 'audio' },
  { ext: 'oga', mime: 'audio/ogg', name: 'Ogg audio', category: 'audio' },
  { ext: 'opus', mime: 'audio/ogg', name: 'Opus audio', category: 'audio' },
  { ext: 'flac', mime: 'audio/flac', name: 'FLAC audio', category: 'audio' },
  { ext: 'wav', mime: 'audio/wav', name: 'WAV audio', category: 'audio' },
  { ext: 'wave', mime: 'audio/wav', name: 'WAV audio', category: 'audio' },
  { ext: 'aiff', mime: 'audio/aiff', name: 'AIFF audio', category: 'audio' },
  { ext: 'aif', mime: 'audio/aiff', name: 'AIFF audio', category: 'audio' },
  { ext: 'aifc', mime: 'audio/aiff', name: 'AIFF-C audio', category: 'audio' },
  { ext: 'au', mime: 'audio/basic', name: 'AU audio', category: 'audio' },
  { ext: 'snd', mime: 'audio/basic', name: 'AU audio', category: 'audio' },
  { ext: 'mid', mime: 'audio/midi', name: 'MIDI', category: 'audio' },
  { ext: 'midi', mime: 'audio/midi', name: 'MIDI', category: 'audio' },
  { ext: 'kar', mime: 'audio/midi', name: 'Karaoke MIDI', category: 'audio' },
  { ext: 'rmi', mime: 'audio/midi', name: 'MIDI', category: 'audio' },
  { ext: 'wma', mime: 'audio/x-ms-wma', name: 'Windows Media audio', category: 'audio' },
  { ext: 'ra', mime: 'audio/x-pn-realaudio', name: 'RealAudio', category: 'audio' },
  { ext: 'ram', mime: 'audio/x-pn-realaudio', name: 'RealAudio', category: 'audio' },
  { ext: 'rm', mime: 'application/vnd.rn-realmedia', name: 'RealMedia', category: 'audio' },
  { ext: 'dts', mime: 'audio/vnd.dts', name: 'DTS audio', category: 'audio' },
  { ext: 'dtshd', mime: 'audio/vnd.dts.hd', name: 'DTS-HD audio', category: 'audio' },
  { ext: 'amr', mime: 'audio/amr', name: 'AMR audio', category: 'audio' },
  { ext: 'awb', mime: 'audio/amr-wb', name: 'AMR-WB audio', category: 'audio' },
  { ext: 'ape', mime: 'audio/ape', name: 'Monkey\'s audio', category: 'audio' },
  { ext: 'mac', mime: 'audio/ape', name: 'Monkey\'s audio', category: 'audio' },
  { ext: 'wv', mime: 'audio/wavpack', name: 'WavPack', category: 'audio' },
  { ext: 'tta', mime: 'audio/tta', name: 'True Audio', category: 'audio' },
  { ext: 'weba', mime: 'audio/webm', name: 'WebM audio', category: 'audio' },
  { ext: 'mka', mime: 'audio/x-matroska', name: 'Matroska audio', category: 'audio' },
  { ext: '3ga', mime: 'audio/3gpp', name: '3GPP audio', category: 'audio' },

  /* ----------------------------- video ---------------------------- */
  { ext: 'mp4', mime: 'video/mp4', name: 'MP4 video', category: 'video' },
  { ext: 'm4v', mime: 'video/mp4', name: 'M4V video', category: 'video' },
  { ext: 'mp4v', mime: 'video/mp4', name: 'MP4 video', category: 'video' },
  { ext: 'webm', mime: 'video/webm', name: 'WebM video', category: 'video' },
  { ext: 'ogv', mime: 'video/ogg', name: 'Ogg video', category: 'video' },
  { ext: 'mov', mime: 'video/quicktime', name: 'QuickTime', category: 'video' },
  { ext: 'qt', mime: 'video/quicktime', name: 'QuickTime', category: 'video' },
  { ext: 'avi', mime: 'video/x-msvideo', name: 'AVI video', category: 'video' },
  { ext: 'wmv', mime: 'video/x-ms-wmv', name: 'Windows Media video', category: 'video' },
  { ext: 'asf', mime: 'video/x-ms-asf', name: 'ASF video', category: 'video' },
  { ext: 'mpg', mime: 'video/mpeg', name: 'MPEG video', category: 'video' },
  { ext: 'mpeg', mime: 'video/mpeg', name: 'MPEG video', category: 'video' },
  { ext: 'mpe', mime: 'video/mpeg', name: 'MPEG video', category: 'video' },
  { ext: 'm2v', mime: 'video/mpeg', name: 'MPEG video', category: 'video' },
  { ext: 'vob', mime: 'video/x-ms-vob', name: 'DVD-Video', category: 'video' },
  { ext: 'flv', mime: 'video/x-flv', name: 'Flash video', category: 'video' },
  { ext: 'f4v', mime: 'video/x-f4v', name: 'Flash MP4', category: 'video' },
  { ext: 'mkv', mime: 'video/x-matroska', name: 'Matroska video', category: 'video' },
  { ext: 'mk3d', mime: 'video/x-matroska-3d', name: 'Matroska 3D', category: 'video' },
  { ext: '3gp', mime: 'video/3gpp', name: '3GPP video', category: 'video' },
  { ext: '3g2', mime: 'video/3gpp2', name: '3GPP2 video', category: 'video' },
  { ext: '3gpp', mime: 'video/3gpp', name: '3GPP video', category: 'video' },
  { ext: 'm2ts', mime: 'video/mp2t', name: 'MPEG-TS', category: 'video' },
  { ext: 'rmvb', mime: 'application/vnd.rn-realmedia-vbr', name: 'RealMedia VBR', category: 'video' },
  { ext: 'divx', mime: 'video/divx', name: 'DivX video', category: 'video' },
  { ext: 'avchd', mime: 'video/avchd', name: 'AVCHD', category: 'video' },
  { ext: 'hevc', mime: 'video/hevc', name: 'HEVC video', category: 'video' },
  { ext: 'h265', mime: 'video/hevc', name: 'HEVC video', category: 'video' },
  { ext: 'h264', mime: 'video/h264', name: 'H.264 video', category: 'video' },
  { ext: 'y4m', mime: 'video/x-yuv4mpegp', name: 'YUV4MPEG', category: 'video' },

  /* --------------------------- application ------------------------ */
  { ext: 'bin', mime: 'application/octet-stream', name: 'Binary', category: 'binary' },
  { ext: 'exe', mime: 'application/x-msdownload', name: 'Windows executable', category: 'application' },
  { ext: 'dll', mime: 'application/x-msdownload', name: 'Windows library', category: 'application' },
  { ext: 'so', mime: 'application/octet-stream', name: 'Shared object', category: 'application' },
  { ext: 'dylib', mime: 'application/octet-stream', name: 'macOS library', category: 'application' },
  { ext: 'class', mime: 'application/java-vm', name: 'Java class', category: 'application' },
  { ext: 'jar', mime: 'application/java-archive', name: 'Java archive', category: 'application' },
  { ext: 'war', mime: 'application/java-archive', name: 'Java web archive', category: 'application' },
  { ext: 'ear', mime: 'application/java-archive', name: 'Java enterprise archive', category: 'application' },
  { ext: 'swf', mime: 'application/x-shockwave-flash', name: 'Flash', category: 'application' },
  { ext: 'spl', mime: 'application/x-futuresplash', name: 'FutureSplash', category: 'application' },
  { ext: 'torrent', mime: 'application/x-bittorrent', name: 'BitTorrent', category: 'application' },
  { ext: 'wasm', mime: 'application/wasm', name: 'WebAssembly', category: 'application' },
  { ext: 'm3u', mime: 'application/vnd.apple.mpegurl', name: 'HLS playlist', category: 'application' },
  { ext: 'm3u8', mime: 'application/vnd.apple.mpegurl', name: 'HLS playlist', category: 'application' },
  { ext: 'pls', mime: 'application/pls+xml', name: 'PLS playlist', category: 'application' },
  { ext: 'xspf', mime: 'application/xspf+xml', name: 'XSPF playlist', category: 'application' },
  { ext: 'apk', mime: 'application/vnd.android.package-archive', name: 'Android package', category: 'application' },
  { ext: 'aab', mime: 'application/vnd.android.package-archive', name: 'Android app bundle', category: 'application' },
  { ext: 'ipa', mime: 'application/octet-stream', name: 'iOS package', category: 'application' },
  { ext: 'deb', mime: 'application/vnd.debian.binary-package', name: 'Debian package', category: 'application' },
  { ext: 'rpm', mime: 'application/x-rpm', name: 'RPM package', category: 'application' },
  { ext: 'msi', mime: 'application/x-msi', name: 'Windows installer', category: 'application' },
  { ext: 'dmg', mime: 'application/x-apple-diskimage', name: 'macOS disk image', category: 'application' },
  { ext: 'iso', mime: 'application/x-iso9660-image', name: 'ISO image', category: 'application' },
  { ext: 'img', mime: 'application/octet-stream', name: 'Disk image', category: 'application' },
  { ext: 'vmdk', mime: 'application/vmdk', name: 'VMware disk', category: 'application' },
  { ext: 'vhd', mime: 'application/x-vhd', name: 'VHD disk', category: 'application' },
  { ext: 'crx', mime: 'application/x-chrome-extension', name: 'Chrome extension', category: 'application' },
  { ext: 'xpi', mime: 'application/x-xpinstall', name: 'Firefox extension', category: 'application' },
  { ext: 'vsix', mime: 'application/vsix', name: 'VS Code extension', category: 'application' },
  { ext: 'ova', mime: 'application/x-virtualbox-ova', name: 'VirtualBox OVA', category: 'application' },
  { ext: 'ovf', mime: 'application/x-virtualbox-ovf', name: 'VirtualBox OVF', category: 'application' },

  /* ----------------------------- fonts ---------------------------- */
  { ext: 'woff', mime: 'font/woff', name: 'WOFF font', category: 'font' },
  { ext: 'woff2', mime: 'font/woff2', name: 'WOFF2 font', category: 'font' },
  { ext: 'ttf', mime: 'font/ttf', name: 'TrueType font', category: 'font' },
  { ext: 'otf', mime: 'font/otf', name: 'OpenType font', category: 'font' },
  { ext: 'eot', mime: 'application/vnd.ms-fontobject', name: 'Embedded OpenType', category: 'font' },
  { ext: 'pfb', mime: 'application/x-font-type1', name: 'Type 1 font', category: 'font' },
  { ext: 'pfa', mime: 'application/x-font-type1', name: 'Type 1 font', category: 'font' },
  { ext: 'psf', mime: 'application/x-font-linux-psf', name: 'Linux PSF font', category: 'font' },
  { ext: 'dfont', mime: 'application/x-dfont', name: 'macOS data fork font', category: 'font' },
  { ext: 'fon', mime: 'application/octet-stream', name: 'Windows font', category: 'font' },
  { ext: 'pcf', mime: 'application/x-font-pcf', name: 'PCF font', category: 'font' },
  { ext: 'bdf', mime: 'application/x-font-bdf', name: 'BDF font', category: 'font' },

  /* ---------------------------- archives -------------------------- */
  { ext: 'zip', mime: 'application/zip', name: 'ZIP archive', category: 'archive' },
  { ext: 'tar', mime: 'application/x-tar', name: 'Tar archive', category: 'archive' },
  { ext: 'gz', mime: 'application/gzip', name: 'Gzip', category: 'archive' },
  { ext: 'tgz', mime: 'application/gzip', name: 'Gzipped tar', category: 'archive' },
  { ext: 'taz', mime: 'application/gzip', name: 'Gzipped tar', category: 'archive' },
  { ext: 'bz2', mime: 'application/x-bzip2', name: 'Bzip2', category: 'archive' },
  { ext: 'bz', mime: 'application/x-bzip2', name: 'Bzip2', category: 'archive' },
  { ext: 'tbz2', mime: 'application/x-bzip2', name: 'Bzip2 tar', category: 'archive' },
  { ext: 'xz', mime: 'application/x-xz', name: 'XZ', category: 'archive' },
  { ext: 'txz', mime: 'application/x-xz', name: 'XZ tar', category: 'archive' },
  { ext: 'lz', mime: 'application/x-lzip', name: 'Lzip', category: 'archive' },
  { ext: 'lzma', mime: 'application/x-lzma', name: 'LZMA', category: 'archive' },
  { ext: 'zst', mime: 'application/zstd', name: 'Zstandard', category: 'archive' },
  { ext: 'zstd', mime: 'application/zstd', name: 'Zstandard', category: 'archive' },
  { ext: 'tzst', mime: 'application/zstd', name: 'Zstd tar', category: 'archive' },
  { ext: '7z', mime: 'application/x-7z-compressed', name: '7-Zip', category: 'archive' },
  { ext: 'rar', mime: 'application/vnd.rar', name: 'RAR archive', category: 'archive' },
  { ext: 'r00', mime: 'application/vnd.rar', name: 'RAR archive', category: 'archive' },
  { ext: 'ace', mime: 'application/x-ace-compressed', name: 'ACE archive', category: 'archive' },
  { ext: 'cab', mime: 'application/vnd.ms-cab-compressed', name: 'Cabinet', category: 'archive' },
  { ext: 'lha', mime: 'application/x-lzh-compressed', name: 'LHA archive', category: 'archive' },
  { ext: 'lzh', mime: 'application/x-lzh-compressed', name: 'LHA archive', category: 'archive' },
  { ext: 'sit', mime: 'application/x-stuffit', name: 'StuffIt', category: 'archive' },
  { ext: 'sitx', mime: 'application/x-stuffitx', name: 'StuffIt X', category: 'archive' },
  { ext: 'sea', mime: 'application/x-sea', name: 'Self-extracting', category: 'archive' },
  { ext: 'arj', mime: 'application/x-arj', name: 'ARJ archive', category: 'archive' },
  { ext: 'z', mime: 'application/x-compress', name: 'Unix compress', category: 'archive' },
  { ext: 'cpio', mime: 'application/x-cpio', name: 'cpio archive', category: 'archive' },
  { ext: 'shar', mime: 'application/x-shar', name: 'Shell archive', category: 'archive' },
  { ext: 'dcm', mime: 'application/dicom', name: 'DICOM', category: 'archive' },
  { ext: 'dcm30', mime: 'application/dicom', name: 'DICOM', category: 'archive' },

  /* --------------------------- documents -------------------------- */
  { ext: 'pdf', mime: 'application/pdf', name: 'PDF document', category: 'document' },
  { ext: 'ps', mime: 'application/postscript', name: 'PostScript', category: 'document' },
  { ext: 'eps', mime: 'application/postscript', name: 'Encapsulated PostScript', category: 'document' },
  { ext: 'ai', mime: 'application/postscript', name: 'Illustrator', category: 'document' },
  { ext: 'doc', mime: 'application/msword', name: 'Word document', category: 'document' },
  { ext: 'dot', mime: 'application/msword', name: 'Word template', category: 'document' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'Word document (OOXML)', category: 'document' },
  { ext: 'docm', mime: 'application/vnd.ms-word.document.macroEnabled.12', name: 'Word macro document', category: 'document' },
  { ext: 'dotx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template', name: 'Word template (OOXML)', category: 'document' },
  { ext: 'xls', mime: 'application/vnd.ms-excel', name: 'Excel spreadsheet', category: 'document' },
  { ext: 'xlt', mime: 'application/vnd.ms-excel', name: 'Excel template', category: 'document' },
  { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'Excel spreadsheet (OOXML)', category: 'document' },
  { ext: 'xlsm', mime: 'application/vnd.ms-excel.sheet.macroEnabled.12', name: 'Excel macro sheet', category: 'document' },
  { ext: 'xlsb', mime: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12', name: 'Excel binary sheet', category: 'document' },
  { ext: 'ppt', mime: 'application/vnd.ms-powerpoint', name: 'PowerPoint', category: 'document' },
  { ext: 'pps', mime: 'application/vnd.ms-powerpoint', name: 'PowerPoint slideshow', category: 'document' },
  { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', name: 'PowerPoint (OOXML)', category: 'document' },
  { ext: 'ppsx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', name: 'PowerPoint slideshow (OOXML)', category: 'document' },
  { ext: 'odt', mime: 'application/vnd.oasis.opendocument.text', name: 'OpenDocument text', category: 'document' },
  { ext: 'ott', mime: 'application/vnd.oasis.opendocument.text-template', name: 'OpenDocument text template', category: 'document' },
  { ext: 'ods', mime: 'application/vnd.oasis.opendocument.spreadsheet', name: 'OpenDocument spreadsheet', category: 'document' },
  { ext: 'ots', mime: 'application/vnd.oasis.opendocument.spreadsheet-template', name: 'OpenDocument spreadsheet template', category: 'document' },
  { ext: 'odp', mime: 'application/vnd.oasis.opendocument.presentation', name: 'OpenDocument presentation', category: 'document' },
  { ext: 'otp', mime: 'application/vnd.oasis.opendocument.presentation-template', name: 'OpenDocument presentation template', category: 'document' },
  { ext: 'odg', mime: 'application/vnd.oasis.opendocument.graphics', name: 'OpenDocument graphics', category: 'document' },
  { ext: 'odf', mime: 'application/vnd.oasis.opendocument.formula', name: 'OpenDocument formula', category: 'document' },
  { ext: 'pages', mime: 'application/vnd.apple.pages', name: 'Apple Pages', category: 'document' },
  { ext: 'numbers', mime: 'application/vnd.apple.numbers', name: 'Apple Numbers', category: 'document' },
  { ext: 'keynote', mime: 'application/vnd.apple.keynote', name: 'Apple Keynote', category: 'document' },
  { ext: 'epub', mime: 'application/epub+zip', name: 'EPUB book', category: 'document' },
  { ext: 'mobi', mime: 'application/x-mobipocket-ebook', name: 'Mobipocket ebook', category: 'document' },
  { ext: 'azw', mime: 'application/vnd.amazon.ebook', name: 'Kindle ebook', category: 'document' },
  { ext: 'azw3', mime: 'application/vnd.amazon.ebook', name: 'Kindle ebook', category: 'document' },
  { ext: 'kfx', mime: 'application/vnd.amazon.ebook', name: 'Kindle ebook', category: 'document' },
  { ext: 'fb2', mime: 'application/x-fictionbook+xml', name: 'FictionBook', category: 'document' },
  { ext: 'cbz', mime: 'application/vnd.comicbook+zip', name: 'Comic book ZIP', category: 'document' },
  { ext: 'cbr', mime: 'application/vnd.comicbook-rar', name: 'Comic book RAR', category: 'document' },
  { ext: 'cb7', mime: 'application/vnd.comicbook+7z', name: 'Comic book 7z', category: 'document' },
  { ext: 'cbt', mime: 'application/vnd.comicbook+tar', name: 'Comic book tar', category: 'document' },
  { ext: 'tex', mime: 'application/x-tex', name: 'TeX', category: 'document' },
  { ext: 'texi', mime: 'application/x-texinfo', name: 'Texinfo', category: 'document' },
  { ext: 'texinfo', mime: 'application/x-texinfo', name: 'Texinfo', category: 'document' },
  { ext: 'dvi', mime: 'application/x-dvi', name: 'DVI document', category: 'document' },
  { ext: 'djvu', mime: 'image/vnd.djvu', name: 'DjVu', category: 'document' },
  { ext: 'djv', mime: 'image/vnd.djvu', name: 'DjVu', category: 'document' },
  { ext: 'chm', mime: 'application/vnd.ms-htmlhelp', name: 'HTML help', category: 'document' },
  { ext: 'hlp', mime: 'application/winhlp', name: 'Windows help', category: 'document' },

  /* ----------------------------- code ----------------------------- */
  { ext: 'js', mime: 'text/javascript', name: 'JavaScript', category: 'code' },
  { ext: 'mjs', mime: 'text/javascript', name: 'JavaScript module', category: 'code' },
  { ext: 'cjs', mime: 'text/javascript', name: 'CommonJS module', category: 'code' },
  { ext: 'jsx', mime: 'text/jsx', name: 'JSX', category: 'code' },
  { ext: 'ts', mime: 'text/typescript', name: 'TypeScript', category: 'code' },
  { ext: 'tsx', mime: 'text/tsx', name: 'TSX', category: 'code' },
  { ext: 'mts', mime: 'text/typescript', name: 'TypeScript module', category: 'code' },
  { ext: 'cts', mime: 'text/typescript', name: 'TypeScript CJS', category: 'code' },
  { ext: 'json', mime: 'application/json', name: 'JSON', category: 'code' },
  { ext: 'json5', mime: 'application/json5', name: 'JSON5', category: 'code' },
  { ext: 'jsonc', mime: 'application/json', name: 'JSON with comments', category: 'code' },
  { ext: 'geojson', mime: 'application/geo+json', name: 'GeoJSON', category: 'code' },
  { ext: 'topojson', mime: 'application/topo+json', name: 'TopoJSON', category: 'code' },
  { ext: 'ndjson', mime: 'application/x-ndjson', name: 'NDJSON', category: 'code' },
  { ext: 'jsonld', mime: 'application/ld+json', name: 'JSON-LD', category: 'code' },
  { ext: 'c', mime: 'text/x-c', name: 'C source', category: 'code' },
  { ext: 'h', mime: 'text/x-c', name: 'C header', category: 'code' },
  { ext: 'cc', mime: 'text/x-c++', name: 'C++ source', category: 'code' },
  { ext: 'cpp', mime: 'text/x-c++', name: 'C++ source', category: 'code' },
  { ext: 'cxx', mime: 'text/x-c++', name: 'C++ source', category: 'code' },
  { ext: 'c++', mime: 'text/x-c++', name: 'C++ source', category: 'code' },
  { ext: 'hpp', mime: 'text/x-c++', name: 'C++ header', category: 'code' },
  { ext: 'hxx', mime: 'text/x-c++', name: 'C++ header', category: 'code' },
  { ext: 'hh', mime: 'text/x-c++', name: 'C++ header', category: 'code' },
  { ext: 'cs', mime: 'text/x-csharp', name: 'C# source', category: 'code' },
  { ext: 'vb', mime: 'text/x-vb', name: 'Visual Basic', category: 'code' },
  { ext: 'java', mime: 'text/x-java-source', name: 'Java source', category: 'code' },
  { ext: 'kt', mime: 'text/x-kotlin', name: 'Kotlin', category: 'code' },
  { ext: 'kts', mime: 'text/x-kotlin', name: 'Kotlin script', category: 'code' },
  { ext: 'scala', mime: 'text/x-scala', name: 'Scala', category: 'code' },
  { ext: 'sc', mime: 'text/x-scala', name: 'Scala', category: 'code' },
  { ext: 'groovy', mime: 'text/x-groovy', name: 'Groovy', category: 'code' },
  { ext: 'gradle', mime: 'text/x-groovy', name: 'Gradle script', category: 'code' },
  { ext: 'py', mime: 'text/x-python', name: 'Python', category: 'code' },
  { ext: 'pyw', mime: 'text/x-python', name: 'Python (windowed)', category: 'code' },
  { ext: 'pyi', mime: 'text/x-python', name: 'Python stub', category: 'code' },
  { ext: 'rb', mime: 'text/x-ruby', name: 'Ruby', category: 'code' },
  { ext: 'rbw', mime: 'text/x-ruby', name: 'Ruby', category: 'code' },
  { ext: 'php', mime: 'application/x-httpd-php', name: 'PHP', category: 'code' },
  { ext: 'phtml', mime: 'application/x-httpd-php', name: 'PHP HTML', category: 'code' },
  { ext: 'php3', mime: 'application/x-httpd-php', name: 'PHP', category: 'code' },
  { ext: 'php4', mime: 'application/x-httpd-php', name: 'PHP', category: 'code' },
  { ext: 'php5', mime: 'application/x-httpd-php', name: 'PHP', category: 'code' },
  { ext: 'ps1', mime: 'application/x-powershell', name: 'PowerShell', category: 'code' },
  { ext: 'psm1', mime: 'application/x-powershell', name: 'PowerShell module', category: 'code' },
  { ext: 'psd1', mime: 'application/x-powershell', name: 'PowerShell data', category: 'code' },
  { ext: 'sh', mime: 'application/x-sh', name: 'Shell script', category: 'code' },
  { ext: 'bash', mime: 'application/x-sh', name: 'Bash script', category: 'code' },
  { ext: 'zsh', mime: 'application/x-sh', name: 'Zsh script', category: 'code' },
  { ext: 'fish', mime: 'application/x-fish', name: 'Fish script', category: 'code' },
  { ext: 'csh', mime: 'application/x-csh', name: 'C shell', category: 'code' },
  { ext: 'ksh', mime: 'application/x-sh', name: 'Korn shell', category: 'code' },
  { ext: 'bat', mime: 'application/x-msdos-program', name: 'Windows batch', category: 'code' },
  { ext: 'cmd', mime: 'application/x-msdos-program', name: 'Windows batch', category: 'code' },
  { ext: 'com', mime: 'application/x-msdos-program', name: 'DOS executable', category: 'code' },
  { ext: 'go', mime: 'text/x-go', name: 'Go', category: 'code' },
  { ext: 'rs', mime: 'text/rust', name: 'Rust', category: 'code' },
  { ext: 'rlib', mime: 'application/octet-stream', name: 'Rust library', category: 'code' },
  { ext: 'swift', mime: 'text/x-swift', name: 'Swift', category: 'code' },
  { ext: 'dart', mime: 'application/dart', name: 'Dart', category: 'code' },
  { ext: 'r', mime: 'text/x-r', name: 'R source', category: 'code' },
  { ext: 'rmd', mime: 'text/x-r-markdown', name: 'R Markdown', category: 'code' },
  { ext: 'jl', mime: 'text/x-julia', name: 'Julia', category: 'code' },
  { ext: 'lua', mime: 'text/x-lua', name: 'Lua', category: 'code' },
  { ext: 'pl', mime: 'text/x-perl', name: 'Perl', category: 'code' },
  { ext: 'pm', mime: 'text/x-perl', name: 'Perl module', category: 'code' },
  { ext: 'tcl', mime: 'text/x-tcl', name: 'Tcl', category: 'code' },
  { ext: 'asm', mime: 'text/x-asm', name: 'Assembly', category: 'code' },
  { ext: 's', mime: 'text/x-asm', name: 'Assembly', category: 'code' },
  { ext: 'S', mime: 'text/x-asm', name: 'Assembly', category: 'code' },
  { ext: 'nim', mime: 'text/x-nim', name: 'Nim', category: 'code' },
  { ext: 'cr', mime: 'text/x-crystal', name: 'Crystal', category: 'code' },
  { ext: 'd', mime: 'text/x-d', name: 'D', category: 'code' },
  { ext: 'pas', mime: 'text/x-pascal', name: 'Pascal', category: 'code' },
  { ext: 'pp', mime: 'text/x-pascal', name: 'Pascal', category: 'code' },
  { ext: 'f', mime: 'text/x-fortran', name: 'Fortran', category: 'code' },
  { ext: 'f90', mime: 'text/x-fortran', name: 'Fortran 90', category: 'code' },
  { ext: 'f95', mime: 'text/x-fortran', name: 'Fortran 95', category: 'code' },
  { ext: 'f03', mime: 'text/x-fortran', name: 'Fortran 2003', category: 'code' },
  { ext: 'erl', mime: 'text/x-erlang', name: 'Erlang', category: 'code' },
  { ext: 'hrl', mime: 'text/x-erlang', name: 'Erlang header', category: 'code' },
  { ext: 'ex', mime: 'text/x-elixir', name: 'Elixir', category: 'code' },
  { ext: 'exs', mime: 'text/x-elixir', name: 'Elixir script', category: 'code' },
  { ext: 'elm', mime: 'text/x-elm', name: 'Elm', category: 'code' },
  { ext: 'hs', mime: 'text/x-haskell', name: 'Haskell', category: 'code' },
  { ext: 'lhs', mime: 'text/x-haskell', name: 'Literate Haskell', category: 'code' },
  { ext: 'ml', mime: 'text/x-ocaml', name: 'OCaml', category: 'code' },
  { ext: 'mli', mime: 'text/x-ocaml', name: 'OCaml interface', category: 'code' },
  { ext: 'fs', mime: 'text/x-fsharp', name: 'F#', category: 'code' },
  { ext: 'fsi', mime: 'text/x-fsharp', name: 'F# signature', category: 'code' },
  { ext: 'fsx', mime: 'text/x-fsharp', name: 'F# script', category: 'code' },
  { ext: 'clj', mime: 'text/x-clojure', name: 'Clojure', category: 'code' },
  { ext: 'cljs', mime: 'text/x-clojure', name: 'ClojureScript', category: 'code' },
  { ext: 'cljc', mime: 'text/x-clojure', name: 'Clojure CLR', category: 'code' },
  { ext: 'edn', mime: 'application/edn', name: 'EDN', category: 'code' },
  { ext: 'lisp', mime: 'text/x-lisp', name: 'Lisp', category: 'code' },
  { ext: 'lsp', mime: 'text/x-lisp', name: 'Lisp', category: 'code' },
  { ext: 'scm', mime: 'text/x-scheme', name: 'Scheme', category: 'code' },
  { ext: 'ss', mime: 'text/x-scheme', name: 'Scheme', category: 'code' },
  { ext: 'vim', mime: 'text/x-vim', name: 'Vim script', category: 'code' },
  { ext: 'awk', mime: 'text/x-awk', name: 'AWK', category: 'code' },
  { ext: 'sed', mime: 'text/x-sed', name: 'sed', category: 'code' },
  { ext: 'sql', mime: 'application/sql', name: 'SQL', category: 'code' },
  { ext: 'graphql', mime: 'application/graphql', name: 'GraphQL', category: 'code' },
  { ext: 'gql', mime: 'application/graphql', name: 'GraphQL', category: 'code' },
  { ext: 'proto', mime: 'text/x-protobuf', name: 'Protocol Buffers', category: 'code' },
  { ext: 'thrift', mime: 'application/vnd.apache.thrift', name: 'Thrift', category: 'code' },
  { ext: 'dockerfile', mime: 'text/x-dockerfile', name: 'Dockerfile', category: 'code' },
  { ext: 'containerfile', mime: 'text/x-dockerfile', name: 'Containerfile', category: 'code' },
  { ext: 'makefile', mime: 'text/x-makefile', name: 'Makefile', category: 'code' },
  { ext: 'mk', mime: 'text/x-makefile', name: 'Makefile', category: 'code' },
  { ext: 'cmake', mime: 'text/x-cmake', name: 'CMake', category: 'code' },
  { ext: 'ninja', mime: 'text/x-ninja', name: 'Ninja build', category: 'code' },
  { ext: 'lock', mime: 'text/plain', name: 'Lock file', category: 'code' },
  { ext: 'env', mime: 'text/plain', name: 'Env file', category: 'code' },
  { ext: 'gitignore', mime: 'text/plain', name: 'Git ignore', category: 'code' },
  { ext: 'gitattributes', mime: 'text/plain', name: 'Git attributes', category: 'code' },
  { ext: 'editorconfig', mime: 'text/plain', name: 'EditorConfig', category: 'code' },
  { ext: 'wat', mime: 'text/wat', name: 'WebAssembly text', category: 'code' },

  /* --------------------------- misc / binary ---------------------- */
  { ext: 'dat', mime: 'application/octet-stream', name: 'Data file', category: 'binary' },
  { ext: 'dump', mime: 'application/octet-stream', name: 'Data dump', category: 'binary' },
  { ext: 'db', mime: 'application/octet-stream', name: 'Database', category: 'binary' },
  { ext: 'sqlite', mime: 'application/vnd.sqlite3', name: 'SQLite database', category: 'binary' },
  { ext: 'sqlite3', mime: 'application/vnd.sqlite3', name: 'SQLite database', category: 'binary' },
  { ext: 'db3', mime: 'application/vnd.sqlite3', name: 'SQLite database', category: 'binary' },
  { ext: 'mdb', mime: 'application/x-msaccess', name: 'Access database', category: 'binary' },
  { ext: 'accdb', mime: 'application/x-msaccess', name: 'Access database', category: 'binary' },
  { ext: 'p12', mime: 'application/x-pkcs12', name: 'PKCS#12 certificate', category: 'binary' },
  { ext: 'pfx', mime: 'application/x-pkcs12', name: 'PKCS#12 certificate', category: 'binary' },
  { ext: 'pem', mime: 'application/x-pem-file', name: 'PEM certificate', category: 'binary' },
  { ext: 'crt', mime: 'application/x-x509-ca-cert', name: 'X.509 certificate', category: 'binary' },
  { ext: 'cer', mime: 'application/x-x509-ca-cert', name: 'X.509 certificate', category: 'binary' },
  { ext: 'der', mime: 'application/x-x509-ca-cert', name: 'DER certificate', category: 'binary' },
  { ext: 'key', mime: 'application/x-pem-file', name: 'Private key', category: 'binary' },
  { ext: 'csr', mime: 'application/x-pkcs10', name: 'Certificate request', category: 'binary' },
  { ext: 'crl', mime: 'application/pkix-crl', name: 'CRL', category: 'binary' },
  { ext: 'cat', mime: 'application/vnd.ms-pki.seccat', name: 'Security catalog', category: 'binary' },
  { ext: 'stl', mime: 'application/vnd.ms-pki.stl', name: 'Trust list', category: 'binary' },
  { ext: 'msg', mime: 'application/vnd.ms-outlook', name: 'Outlook message', category: 'binary' },
  { ext: 'eml', mime: 'message/rfc822', name: 'Email message', category: 'binary' },
  { ext: 'mbox', mime: 'application/mbox', name: 'Mailbox', category: 'binary' },
  { ext: 'p7s', mime: 'application/pkcs7-signature', name: 'PKCS#7 signature', category: 'binary' },
  { ext: 'p7b', mime: 'application/x-pkcs7-certificates', name: 'PKCS#7 cert', category: 'binary' },
  { ext: 'p7m', mime: 'application/pkcs7-mime', name: 'PKCS#7 MIME', category: 'binary' },
  { ext: 'swidtag', mime: 'application/swid+xml', name: 'SWID tag', category: 'binary' },
  { ext: 'manifest', mime: 'text/cache-manifest', name: 'AppCache manifest', category: 'binary' },
  { ext: 'appcache', mime: 'text/cache-manifest', name: 'AppCache', category: 'binary' },
  { ext: 'webmanifest', mime: 'application/manifest+json', name: 'Web manifest', category: 'binary' },
  { ext: 'xsd', mime: 'application/xml', name: 'XML schema', category: 'binary' },
  { ext: 'plist', mime: 'application/x-plist', name: 'Property list', category: 'binary' },
  { ext: 'mobileconfig', mime: 'application/x-apple-aspen-config', name: 'Apple config', category: 'binary' },
  { ext: 'swp', mime: 'application/octet-stream', name: 'Vim swap', category: 'binary' },
  { ext: 'swo', mime: 'application/octet-stream', name: 'Vim swap', category: 'binary' },
  { ext: 'tmp', mime: 'application/octet-stream', name: 'Temp file', category: 'binary' },
  { ext: 'temp', mime: 'application/octet-stream', name: 'Temp file', category: 'binary' },
  { ext: 'bak', mime: 'application/octet-stream', name: 'Backup file', category: 'binary' },
  { ext: 'old', mime: 'application/octet-stream', name: 'Old file', category: 'binary' },
  { ext: 'orig', mime: 'application/octet-stream', name: 'Original file', category: 'binary' },
  { ext: 'dsstore', mime: 'application/octet-stream', name: 'macOS DS_Store', category: 'binary' },
  { ext: 'lnk', mime: 'application/x-ms-shortcut', name: 'Windows shortcut', category: 'binary' },
  { ext: 'url', mime: 'application/x-mswinurl', name: 'Internet shortcut', category: 'binary' },
  { ext: 'webloc', mime: 'application/octet-stream', name: 'macOS web shortcut', category: 'binary' },
  { ext: 'thmx', mime: 'application/vnd.ms-officetheme', name: 'Office theme', category: 'binary' },
  { ext: 'onetoc', mime: 'application/onenote', name: 'OneNote', category: 'binary' },
  { ext: 'onetoc2', mime: 'application/onenote', name: 'OneNote', category: 'binary' },
  { ext: 'one', mime: 'application/onenote', name: 'OneNote', category: 'binary' },
  { ext: 'odc', mime: 'application/vnd.oasis.opendocument.chart', name: 'OpenDocument chart', category: 'binary' },
  { ext: 'odb', mime: 'application/vnd.oasis.opendocument.database', name: 'OpenDocument database', category: 'binary' },
  { ext: 'odi', mime: 'application/vnd.oasis.opendocument.image', name: 'OpenDocument image', category: 'binary' },
  { ext: 'odm', mime: 'application/vnd.oasis.opendocument.text-master', name: 'OpenDocument master', category: 'binary' },
  { ext: 'oth', mime: 'application/vnd.oasis.opendocument.text-web', name: 'OpenDocument web', category: 'binary' },
];

/* -------------------------------------------------------------------------- */
/* Derived indexes (built once at module load)                                */
/* -------------------------------------------------------------------------- */

/**
 * Map of canonical lowercase extension (no leading dot) → primary MIME type.
 * When an extension maps to multiple MIME types, the first one encountered in
 * `MIME_ENTRIES` wins (the most common / canonical type).
 */
export const MIME_BY_EXTENSION: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const entry of MIME_ENTRIES) {
    if (!map.has(entry.ext)) map.set(entry.ext, entry.mime);
  }
  return map;
})();

/**
 * Map of canonical lowercase MIME type → array of extensions (in declaration
 * order, deduplicated). A MIME type may legitimately map to several
 * extensions (e.g. `image/jpeg` → `jpg`, `jpeg`, `jpe`, `jfif`).
 */
export const EXTENSIONS_BY_MIME: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const entry of MIME_ENTRIES) {
    const list = map.get(entry.mime);
    if (list) {
      if (!list.includes(entry.ext)) list.push(entry.ext);
    } else {
      map.set(entry.mime, [entry.ext]);
    }
  }
  return map;
})();

/**
 * Map of canonical lowercase extension → first matching `MimeEntry` (used to
 * surface the human-readable name + category in the UI).
 */
export const ENTRY_BY_EXTENSION: ReadonlyMap<string, MimeEntry> = (() => {
  const map = new Map<string, MimeEntry>();
  for (const entry of MIME_ENTRIES) {
    if (!map.has(entry.ext)) map.set(entry.ext, entry);
  }
  return map;
})();

/**
 * Map of canonical lowercase MIME type → first matching `MimeEntry` (used to
 * surface the human-readable name + category in the UI).
 */
export const ENTRY_BY_MIME: ReadonlyMap<string, MimeEntry> = (() => {
  const map = new Map<string, MimeEntry>();
  for (const entry of MIME_ENTRIES) {
    if (!map.has(entry.mime)) map.set(entry.mime, entry);
  }
  return map;
})();

/** All distinct MIME types in declaration order. */
export const ALL_MIME_TYPES: readonly string[] = Array.from(EXTENSIONS_BY_MIME.keys());

/** All distinct extensions in declaration order. */
export const ALL_EXTENSIONS: readonly string[] = Array.from(MIME_BY_EXTENSION.keys());

/** Approximate serialised size of the database (sanity check for ~50KB target). */
export const DATABASE_SIZE_BYTES = MIME_ENTRIES.reduce(
  (sum, e) => sum + e.ext.length + e.mime.length + e.name.length + e.category.length + 4,
  0,
);

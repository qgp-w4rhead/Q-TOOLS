/**
 * useWolPacketBuilder - composable + pure logic for the Wake-on-LAN magic
 * packet builder tool.
 *
 * Builds the standard 102-byte WoL magic packet: 6 bytes of `0xFF` followed
 * by the target MAC-48 repeated 16 times. The packet is emitted as spaced
 * hex, base64, and a downloadable binary, plus ready-to-paste CLI commands
 * (`wakeonlan`, `etherwake`, `wol`, PowerShell, Python) that incorporate the
 * optional broadcast address and UDP port.
 *
 * Pure helpers (`parseMac`, `buildMagicPacket`, `packetToHex`,
 * `packetToBase64`, `buildCliCommands`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The
 * `useWolPacketBuilder()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies - byte-array math + `btoa` only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type MacOctets = [number, number, number, number, number, number];

export interface WolCommands {
  /** `wakeonlan [-i bcast] [-p port] MAC` */
  wakeonlan: string;
  /** `etherwake [-i iface] MAC` (broadcast via `-b`). */
  etherwake: string;
  /** `wol` (open-wol style). */
  wol: string;
  /** PowerShell one-liner sending the packet via UdpClient. */
  powershell: string;
  /** Python 3 one-liner sending the packet via socket. */
  python: string;
}

export interface WolResult {
  /** Normalised MAC `AA:BB:CC:DD:EE:FF`. */
  mac: string;
  /** The 102-byte magic packet. */
  packet: Uint8Array;
  /** Packet length (always 102). */
  length: number;
  /** Spaced uppercase hex (`FF FF FF …`). */
  hex: string;
  /** Base64 encoding of the packet. */
  base64: string;
  /** Broadcast address used in the CLI commands. */
  broadcast: string;
  /** UDP port used in the CLI commands. */
  port: number;
  /** Ready-to-paste CLI commands. */
  commands: WolCommands;
}

/** Parse a MAC-48 address from any common notation. */
export function parseMac(
  input: string,
): { ok: boolean; octets: MacOctets | null; error: string | null } {
  const raw = input.trim();
  if (raw.length === 0) {
    return { ok: false, octets: null, error: 'MAC address is empty.' };
  }
  const hex = raw.replace(/[\s:.-]/g, '');
  if (!/^[0-9A-Fa-f]+$/.test(hex)) {
    return { ok: false, octets: null, error: 'MAC address contains invalid hex characters.' };
  }
  if (hex.length !== 12) {
    return {
      ok: false,
      octets: null,
      error: `MAC address must be 12 hex digits (6 octets) - got ${hex.length}.`,
    };
  }
  if (/[.:-]/.test(raw)) {
    if (raw.includes('.')) {
      const groups = raw.split('.');
      if (groups.length !== 3 || groups.some((g) => !/^[0-9A-Fa-f]{4}$/.test(g))) {
        return { ok: false, octets: null, error: 'Dot-separated MAC must be Cisco format (AABB.CCDD.EEFF).' };
      }
    } else {
      const sep = raw.includes(':') ? ':' : '-';
      const groups = raw.split(sep);
      if (groups.length !== 6 || groups.some((g) => !/^[0-9A-Fa-f]{2}$/.test(g))) {
        return { ok: false, octets: null, error: 'Separated MAC must have 6 groups of 2 hex digits.' };
      }
    }
  }
  const octets: MacOctets = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    parseInt(hex.slice(6, 8), 16),
    parseInt(hex.slice(8, 10), 16),
    parseInt(hex.slice(10, 12), 16),
  ];
  return { ok: true, octets, error: null };
}

/** Normalise octets to `AA:BB:CC:DD:EE:FF`. */
export function formatMac(octets: MacOctets): string {
  return octets.map((o) => o.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/**
 * Build the 102-byte magic packet: `FF` × 6, then the MAC repeated 16 times.
 */
export function buildMagicPacket(octets: MacOctets): Uint8Array {
  const packet = new Uint8Array(102);
  packet.fill(0xff, 0, 6);
  for (let i = 0; i < 16; i++) {
    packet.set(octets, 6 + i * 6);
  }
  return packet;
}

/** Spaced uppercase hex representation of the packet. */
export function packetToHex(packet: Uint8Array): string {
  return Array.from(packet, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/** Base64 encoding of the packet (chunked `btoa` to avoid arg limits). */
export function packetToBase64(packet: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < packet.length; i += CHUNK) {
    bin += String.fromCharCode(...packet.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Validate a broadcast IPv4 address (dotted quad). */
export function parseBroadcast(input: string): { ok: boolean; value: string; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: '255.255.255.255', error: null };
  }
  const parts = trimmed.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^(?:0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(p))) {
    return { ok: false, value: '', error: 'Broadcast must be a dotted IPv4 address (e.g. 192.168.1.255).' };
  }
  return { ok: true, value: trimmed, error: null };
}

/** Validate a UDP port (1-65535; empty → 9). */
export function parsePort(input: string): { ok: boolean; value: number; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: true, value: 9, error: null };
  if (!/^\d{1,5}$/.test(trimmed)) {
    return { ok: false, value: 0, error: 'Port must be an integer between 1 and 65535.' };
  }
  const n = Number.parseInt(trimmed, 10);
  if (n < 1 || n > 65535) {
    return { ok: false, value: 0, error: 'Port must be between 1 and 65535.' };
  }
  return { ok: true, value: n, error: null };
}

/** Build the ready-to-paste CLI commands for a MAC + broadcast + port. */
export function buildCliCommands(mac: string, broadcast: string, port: number): WolCommands {
  const hex = mac.replace(/:/g, '').toLowerCase();
  return {
    wakeonlan: `wakeonlan -i ${broadcast} -p ${port} ${mac}`,
    etherwake: `etherwake -b ${mac}`,
    wol: `wol ${mac}`,
    powershell:
      `$mac='${mac}';$b=[byte[]]($mac -split ':'|%{[Convert]::ToByte($_,16)});` +
      `$p=[byte[]](,0xFF*6)+[byte[]](,$b*16);` +
      `$u=New-Object Net.Sockets.UdpClient;$u.Connect('${broadcast}',${port});` +
      `$u.Send($p,$p.Length);$u.Close()`,
    python:
      `python3 -c "import socket;s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);` +
      `s.setsockopt(socket.SOL_SOCKET,socket.SO_BROADCAST,1);` +
      `s.sendto(bytes.fromhex('ff'*6+'${hex}'*16),('${broadcast}',${port}))"`,
  };
}

/** Full result for a MAC + broadcast + port. */
export function buildWolResult(
  octets: MacOctets,
  broadcast: string,
  port: number,
): WolResult {
  const packet = buildMagicPacket(octets);
  const mac = formatMac(octets);
  return {
    mac,
    packet,
    length: packet.length,
    hex: packetToHex(packet),
    base64: packetToBase64(packet),
    broadcast,
    port,
    commands: buildCliCommands(mac, broadcast, port),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseWolPacketBuilderReturn {
  macInput: Ref<string>;
  broadcastInput: Ref<string>;
  portInput: Ref<string>;
  result: Ref<WolResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useWolPacketBuilder(): UseWolPacketBuilderReturn {
  const macInput = ref<string>('');
  const broadcastInput = ref<string>('');
  const portInput = ref<string>('');
  const result = ref<WolResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const text = macInput.value.trim();
    if (text.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    const mac = parseMac(text);
    if (!mac.ok || !mac.octets) {
      result.value = null;
      error.value = mac.error;
      return;
    }
    const bcast = parseBroadcast(broadcastInput.value);
    if (!bcast.ok) {
      result.value = null;
      error.value = bcast.error;
      return;
    }
    const port = parsePort(portInput.value);
    if (!port.ok) {
      result.value = null;
      error.value = port.error;
      return;
    }
    error.value = null;
    result.value = buildWolResult(mac.octets, bcast.value, port.value);
  }

  watch([macInput, broadcastInput, portInput], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mac === 'string') macInput.value = p.mac;
      else if (typeof p.address === 'string') macInput.value = p.address;
      else if (typeof p.input === 'string') macInput.value = p.input;
      else if (typeof p.value === 'string') macInput.value = p.value;
      if (typeof p.broadcast === 'string') broadcastInput.value = p.broadcast;
      if (typeof p.port === 'number') portInput.value = String(p.port);
      else if (typeof p.port === 'string') portInput.value = p.port;
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          mac: r.mac,
          length: r.length,
          hex: r.hex,
          base64: r.base64,
          broadcast: r.broadcast,
          port: r.port,
          commands: r.commands,
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return {
    macInput,
    broadcastInput,
    portInput,
    result,
    error,
    isEmbed,
    embedInput,
    recompute,
  };
}

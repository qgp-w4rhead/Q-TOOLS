<script setup lang="ts">
/**
 * PdfSignature — PDF signature checker.
 *
 * Upload a PDF file (drag-and-drop or file picker) to inspect its digital
 * signatures. The tool displays signer name, signing time, certificate
 * issuer, certificate validity, and signature validity. Client-side parsing
 * uses `pdfjs-dist` + `node-forge` (lazy-loaded) for metadata; full PKCS#7
 * chain verification is performed by the backend `/api/pdf/verify` endpoint.
 * If the backend is unreachable, metadata is shown with a warning.
 *
 * Works in embed mode: receives `input` PostMessages with a `url` to fetch a
 * PDF from, and sends `output` PostMessages with the parsed signature list
 * and verification results.
 */
import { computed, ref } from 'vue';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  FileUp,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  usePdfSignature,
  type SignatureInfo,
  type SignatureVerification,
} from './usePdfSignature';

const {
  fileName,
  fileSize,
  pageCount,
  signatures,
  verification,
  backendAvailable,
  parsing,
  verifying,
  error,
  warning,
  onFile,
  verify,
  clear,
} = usePdfSignature();

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref<boolean>(false);

function onDrop(e: DragEvent): void {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) onFile(file);
}

function onPickerChange(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) onFile(file);
}

function pickFile(): void {
  fileInput.value?.click();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** Lookup a verification result by signature index. */
function verifyFor(sig: SignatureInfo): SignatureVerification | undefined {
  return verification.value?.signatures.find((v) => v.index === sig.index);
}

/** Overall status badge for a signature. */
function statusFor(sig: SignatureInfo): { label: string; cls: string; icon: typeof CheckCircle2 } {
  const v = verifyFor(sig);
  if (v) {
    if (v.signatureValid && v.chainValid) return { label: 'Valid', cls: 'pdf-sig__badge--ok', icon: ShieldCheck };
    if (v.signatureValid && !v.chainValid) return { label: 'Signed · chain issues', cls: 'pdf-sig__badge--warn', icon: ShieldAlert };
    return { label: 'Invalid', cls: 'pdf-sig__badge--bad', icon: XCircle };
  }
  if (sig.certificate?.isValidAtSigningTime) return { label: 'Metadata only', cls: 'pdf-sig__badge--info', icon: FileCheck };
  if (sig.certificate) return { label: 'Cert expired at signing', cls: 'pdf-sig__badge--warn', icon: ShieldAlert };
  return { label: 'Unverified', cls: 'pdf-sig__badge--info', icon: FileCheck };
}

const hasResults = computed(
  () => fileName.value !== '' && (signatures.value.length > 0 || warning.value !== '' || parsing.value),
);
</script>

<template>
  <div class="pdf-sig">
    <ToolInput
      title="PDF signature checker"
      description="Upload a signed PDF to inspect its digital signatures. Client-side parsing via pdfjs-dist + node-forge; full PKCS#7 chain verification via the backend."
    >
      <template #actions>
        <button
          v-if="hasResults"
          class="pdf-sig__btn pdf-sig__btn--ghost"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>Clear</span>
        </button>
        <button
          v-if="signatures.length > 0 && backendAvailable !== false"
          class="pdf-sig__btn"
          type="button"
          :disabled="verifying"
          @click="verify"
        >
          <Loader2 v-if="verifying" :size="14" class="pdf-sig__spin" />
          <ShieldCheck v-else :size="14" />
          <span>{{ verifying ? 'Verifying…' : 'Verify signatures' }}</span>
        </button>
      </template>

      <div
        class="pdf-sig__drop"
        :class="{ 'pdf-sig__drop--over': dragOver }"
        role="button"
        tabindex="0"
        @click="pickFile"
        @keydown.enter="pickFile"
        @keydown.space.prevent="pickFile"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <FileUp :size="28" class="pdf-sig__drop-icon" />
        <p class="pdf-sig__drop-title">Drop a PDF here or click to browse</p>
        <p class="pdf-sig__drop-hint">Max 32 MiB · signatures parsed locally</p>
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf,.pdf"
          hidden
          @change="onPickerChange"
        />
      </div>
    </ToolInput>

    <ToolOutput
      v-if="hasResults"
      title="Signature results"
      :description="fileName ? `${fileName} · ${formatSize(fileSize)}${pageCount ? ' · ' + pageCount + ' page' + (pageCount > 1 ? 's' : '') : ''}` : ''"
    >
      <p v-if="error" class="pdf-sig__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>

      <p v-if="parsing" class="pdf-sig__loading">
        <Loader2 :size="14" class="pdf-sig__spin" />
        <span>Parsing PDF and extracting signatures…</span>
      </p>

      <p v-else-if="warning && signatures.length === 0" class="pdf-sig__warning">
        <ShieldAlert :size="14" />
        <span>{{ warning }}</span>
      </p>

      <div v-if="signatures.length > 0" class="pdf-sig__list">
        <div v-for="sig in signatures" :key="sig.index" class="pdf-sig__card">
          <div class="pdf-sig__card-head">
            <span class="pdf-sig__card-title">
              <FileCheck :size="15" />
              <span>Signature {{ sig.index + 1 }}</span>
            </span>
            <span class="pdf-sig__badge" :class="statusFor(sig).cls">
              <component :is="statusFor(sig).icon" :size="12" />
              <span>{{ statusFor(sig).label }}</span>
            </span>
          </div>

          <dl class="pdf-sig__grid">
            <div class="pdf-sig__field">
              <dt>Signer name</dt>
              <dd>{{ sig.signerName || '—' }}</dd>
            </div>
            <div class="pdf-sig__field">
              <dt>Signing time</dt>
              <dd>{{ formatDate(sig.signingTimeISO) }}</dd>
            </div>
            <div class="pdf-sig__field">
              <dt>Sub-filter</dt>
              <dd><code>{{ sig.subFilter || '—' }}</code></dd>
            </div>
            <div class="pdf-sig__field">
              <dt>Byte range</dt>
              <dd><code class="pdf-sig__mono">{{ sig.byteRange.join(' · ') }}</code></dd>
            </div>
          </dl>

          <template v-if="sig.certificate">
            <div class="pdf-sig__divider">Certificate</div>
            <dl class="pdf-sig__grid">
              <div class="pdf-sig__field">
                <dt>Subject</dt>
                <dd>{{ sig.certificate.subject }}</dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Issuer</dt>
                <dd>{{ sig.certificate.issuer }}</dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Serial</dt>
                <dd><code class="pdf-sig__mono">{{ sig.certificate.serialNumber }}</code></dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Validity</dt>
                <dd>
                  {{ formatDate(sig.certificate.notBefore) }} → {{ formatDate(sig.certificate.notAfter) }}
                </dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Valid at signing time</dt>
                <dd>
                  <CheckCircle2 v-if="sig.certificate.isValidAtSigningTime" :size="13" class="pdf-sig__ok" />
                  <XCircle v-else :size="13" class="pdf-sig__bad" />
                  <span>{{ sig.certificate.isValidAtSigningTime ? 'Yes' : 'No' }}</span>
                </dd>
              </div>
            </dl>
          </template>

          <p v-else-if="sig.parseError" class="pdf-sig__warning pdf-sig__warning--inline">
            <ShieldAlert :size="13" />
            <span>Could not parse PKCS#7: {{ sig.parseError }}</span>
          </p>

          <template v-if="verifyFor(sig)">
            <div class="pdf-sig__divider">Verification (backend)</div>
            <dl class="pdf-sig__grid">
              <div class="pdf-sig__field">
                <dt>Signature valid</dt>
                <dd>
                  <CheckCircle2 v-if="verifyFor(sig)!.signatureValid" :size="13" class="pdf-sig__ok" />
                  <XCircle v-else :size="13" class="pdf-sig__bad" />
                  <span>{{ verifyFor(sig)!.signatureValid ? 'Yes' : 'No' }}</span>
                </dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Chain valid</dt>
                <dd>
                  <CheckCircle2 v-if="verifyFor(sig)!.chainValid" :size="13" class="pdf-sig__ok" />
                  <XCircle v-else :size="13" class="pdf-sig__bad" />
                  <span>{{ verifyFor(sig)!.chainValid ? 'Yes' : 'No' }}</span>
                </dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Trust status</dt>
                <dd>{{ verifyFor(sig)!.trustStatus }}</dd>
              </div>
              <div class="pdf-sig__field">
                <dt>Digest algorithm</dt>
                <dd><code class="pdf-sig__mono">{{ verifyFor(sig)!.digestAlgorithm || '—' }}</code></dd>
              </div>
            </dl>
            <ul v-if="verifyFor(sig)!.errors.length" class="pdf-sig__errors">
              <li v-for="(err, i) in verifyFor(sig)!.errors" :key="i">{{ err }}</li>
            </ul>
          </template>
        </div>
      </div>

      <p v-if="backendAvailable === false && signatures.length > 0" class="pdf-sig__warning pdf-sig__warning--inline">
        <ShieldAlert :size="13" />
        <span>Backend verification unavailable — showing metadata only.</span>
      </p>
    </ToolOutput>
  </div>
</template>

<style scoped>
.pdf-sig {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.pdf-sig__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 2px dashed var(--qt-border);
  border-radius: var(--qt-radius);
  background: var(--qt-bg);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
  will-change: border-color;
}
.pdf-sig__drop:hover,
.pdf-sig__drop--over {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.06);
}
.pdf-sig__drop-icon {
  color: var(--qt-muted);
  transition: transform 0.15s ease, color 0.15s ease;
  will-change: transform;
}
.pdf-sig__drop:hover .pdf-sig__drop-icon,
.pdf-sig__drop--over .pdf-sig__drop-icon {
  color: var(--qt-accent);
  transform: translateY(-2px);
}
.pdf-sig__drop-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.pdf-sig__drop-hint {
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
}
.pdf-sig__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.pdf-sig__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.pdf-sig__btn:active:not(:disabled) {
  transform: translateY(0);
}
.pdf-sig__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pdf-sig__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.pdf-sig__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.pdf-sig__spin {
  animation: pdf-sig-spin 0.8s linear infinite;
}
@keyframes pdf-sig-spin {
  to {
    transform: rotate(360deg);
  }
}
.pdf-sig__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.pdf-sig__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.pdf-sig__warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-warning);
  font-size: 13.5px;
}
.pdf-sig__warning--inline {
  margin-top: 8px;
}
.pdf-sig__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pdf-sig__card {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pdf-sig__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pdf-sig__card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.pdf-sig__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid transparent;
}
.pdf-sig__badge--ok {
  color: var(--qt-success);
  background: oklch(from var(--qt-success) 95% c h / 0.12);
  border-color: oklch(from var(--qt-success) 60% c h / 0.4);
}
.pdf-sig__badge--warn {
  color: var(--qt-warning);
  background: oklch(from var(--qt-warning) 95% c h / 0.12);
  border-color: oklch(from var(--qt-warning) 60% c h / 0.4);
}
.pdf-sig__badge--bad {
  color: var(--qt-danger);
  background: oklch(from var(--qt-danger) 95% c h / 0.12);
  border-color: oklch(from var(--qt-danger) 60% c h / 0.4);
}
.pdf-sig__badge--info {
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.12);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.4);
}
.pdf-sig__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 16px;
  margin: 0;
}
@media (max-width: 640px) {
  .pdf-sig__grid {
    grid-template-columns: 1fr;
  }
}
.pdf-sig__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pdf-sig__field dt {
  font-size: 11px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.pdf-sig__field dd {
  margin: 0;
  font-size: 13px;
  color: var(--qt-text);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  word-break: break-word;
}
.pdf-sig__mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11.5px;
  word-break: break-all;
}
.pdf-sig__ok {
  color: var(--qt-success);
}
.pdf-sig__bad {
  color: var(--qt-danger);
}
.pdf-sig__divider {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--qt-border);
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pdf-sig__errors {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--qt-danger);
}
.pdf-sig__errors li {
  margin: 2px 0;
}
</style>

<script setup lang="ts">
/**
 * PdfSignature - PDF signature checker.
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
import { useI18n } from 'vue-i18n';
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

const { t, locale } = useI18n();

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
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(locale.value);
  } catch {
    return iso;
  }
}

/** Lookup a verification result by signature index. */
function verifyFor(sig: SignatureInfo): SignatureVerification | undefined {
  return verification.value?.signatures.find((v) => v.index === sig.index);
}

/** Overall status badge for a signature (label resolved via i18n). */
function statusFor(sig: SignatureInfo): { label: string; cls: string; icon: typeof CheckCircle2 } {
  const v = verifyFor(sig);
  if (v) {
    if (v.signatureValid && v.chainValid) return { label: t('tools.pdf-signature-checker.ui.statusValid'), cls: 'qt-badge--success', icon: ShieldCheck };
    if (v.signatureValid && !v.chainValid) return { label: t('tools.pdf-signature-checker.ui.statusChainIssues'), cls: 'qt-badge--warn', icon: ShieldAlert };
    return { label: t('tools.pdf-signature-checker.ui.statusInvalid'), cls: 'qt-badge--error', icon: XCircle };
  }
  if (sig.certificate?.isValidAtSigningTime) return { label: t('tools.pdf-signature-checker.ui.statusMetadataOnly'), cls: 'qt-badge--info', icon: FileCheck };
  if (sig.certificate) return { label: t('tools.pdf-signature-checker.ui.statusCertExpired'), cls: 'qt-badge--warn', icon: ShieldAlert };
  return { label: t('tools.pdf-signature-checker.ui.statusUnverified'), cls: 'qt-badge--info', icon: FileCheck };
}

const hasResults = computed(
  () => fileName.value !== '' && (signatures.value.length > 0 || warning.value !== '' || parsing.value),
);
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('tools.pdf-signature-checker.ui.title')"
      :description="t('tools.pdf-signature-checker.ui.desc')"
    >
      <template #actions>
        <button
          v-if="hasResults"
          class="qt-btn qt-btn--outline"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>{{ t('tools.pdf-signature-checker.ui.clear') }}</span>
        </button>
        <button
          v-if="signatures.length > 0 && backendAvailable !== false"
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="verifying"
          @click="verify"
        >
          <Loader2 v-if="verifying" :size="14" class="qt-spin" />
          <ShieldCheck v-else :size="14" />
          <span>{{ verifying ? t('tools.pdf-signature-checker.ui.verifying') : t('tools.pdf-signature-checker.ui.verifySignatures') }}</span>
        </button>
      </template>

      <div
        class="qt-drop"
        :class="{ 'qt-drop--over': dragOver }"
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
        <p class="pdf-sig__drop-title">{{ t('tools.pdf-signature-checker.ui.dropTitle') }}</p>
        <p class="qt-hint">{{ t('tools.pdf-signature-checker.ui.dropHint') }}</p>
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
      :title="t('tools.pdf-signature-checker.ui.outputTitle')"
      :description="fileName ? t('tools.pdf-signature-checker.ui.outputDesc', {
        name: fileName,
        size: formatSize(fileSize),
        pages: pageCount ? t('tools.pdf-signature-checker.ui.pageCount', { n: pageCount }, pageCount) : '',
      }) : ''"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>

      <p v-if="parsing" class="qt-alert qt-alert--empty">
        <Loader2 :size="14" class="qt-spin" />
        <span>{{ t('tools.pdf-signature-checker.ui.parsing') }}</span>
      </p>

      <p v-else-if="warning && signatures.length === 0" class="qt-alert qt-alert--warn">
        <ShieldAlert :size="14" />
        <span>{{ warning }}</span>
      </p>

      <div v-if="signatures.length > 0" class="qt-stack" style="--qt-stack-gap:12px">
        <div v-for="sig in signatures" :key="sig.index" class="pdf-sig__card">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="pdf-sig__card-title">
              <FileCheck :size="15" />
              <span>{{ t('tools.pdf-signature-checker.ui.signatureN', { n: sig.index + 1 }) }}</span>
            </span>
            <span class="qt-badge" :class="statusFor(sig).cls">
              <component :is="statusFor(sig).icon" :size="12" />
              <span>{{ statusFor(sig).label }}</span>
            </span>
          </div>

          <dl class="pdf-sig__grid">
            <div class="pdf-sig__field">
              <dt>{{ t('tools.pdf-signature-checker.ui.signerName') }}</dt>
              <dd>{{ sig.signerName || '-' }}</dd>
            </div>
            <div class="pdf-sig__field">
              <dt>{{ t('tools.pdf-signature-checker.ui.signingTime') }}</dt>
              <dd>{{ formatDate(sig.signingTimeISO) }}</dd>
            </div>
            <div class="pdf-sig__field">
              <dt>{{ t('tools.pdf-signature-checker.ui.subFilter') }}</dt>
              <dd><code>{{ sig.subFilter || '-' }}</code></dd>
            </div>
            <div class="pdf-sig__field">
              <dt>{{ t('tools.pdf-signature-checker.ui.byteRange') }}</dt>
              <dd><code class="qt-mono pdf-sig__mono">{{ sig.byteRange.join(' · ') }}</code></dd>
            </div>
          </dl>

          <template v-if="sig.certificate">
            <div class="pdf-sig__divider">{{ t('tools.pdf-signature-checker.ui.certificate') }}</div>
            <dl class="pdf-sig__grid">
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.subject') }}</dt>
                <dd>{{ sig.certificate.subject }}</dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.issuer') }}</dt>
                <dd>{{ sig.certificate.issuer }}</dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.serial') }}</dt>
                <dd><code class="qt-mono pdf-sig__mono">{{ sig.certificate.serialNumber }}</code></dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.validity') }}</dt>
                <dd>
                  {{ formatDate(sig.certificate.notBefore) }} → {{ formatDate(sig.certificate.notAfter) }}
                </dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.validAtSigning') }}</dt>
                <dd>
                  <CheckCircle2 v-if="sig.certificate.isValidAtSigningTime" :size="13" class="pdf-sig__ok" />
                  <XCircle v-else :size="13" class="pdf-sig__bad" />
                  <span>{{ sig.certificate.isValidAtSigningTime ? t('tools.pdf-signature-checker.ui.yes') : t('tools.pdf-signature-checker.ui.no') }}</span>
                </dd>
              </div>
            </dl>
          </template>

          <p v-else-if="sig.parseError" class="qt-alert qt-alert--warn pdf-sig__warning--inline">
            <ShieldAlert :size="13" />
            <span>{{ t('tools.pdf-signature-checker.ui.parseError', { error: sig.parseError }) }}</span>
          </p>

          <template v-if="verifyFor(sig)">
            <div class="pdf-sig__divider">{{ t('tools.pdf-signature-checker.ui.verificationBackend') }}</div>
            <dl class="pdf-sig__grid">
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.signatureValid') }}</dt>
                <dd>
                  <CheckCircle2 v-if="verifyFor(sig)!.signatureValid" :size="13" class="pdf-sig__ok" />
                  <XCircle v-else :size="13" class="pdf-sig__bad" />
                  <span>{{ verifyFor(sig)!.signatureValid ? t('tools.pdf-signature-checker.ui.yes') : t('tools.pdf-signature-checker.ui.no') }}</span>
                </dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.chainValid') }}</dt>
                <dd>
                  <CheckCircle2 v-if="verifyFor(sig)!.chainValid" :size="13" class="pdf-sig__ok" />
                  <XCircle v-else :size="13" class="pdf-sig__bad" />
                  <span>{{ verifyFor(sig)!.chainValid ? t('tools.pdf-signature-checker.ui.yes') : t('tools.pdf-signature-checker.ui.no') }}</span>
                </dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.trustStatus') }}</dt>
                <dd>{{ verifyFor(sig)!.trustStatus }}</dd>
              </div>
              <div class="pdf-sig__field">
                <dt>{{ t('tools.pdf-signature-checker.ui.digestAlgorithm') }}</dt>
                <dd><code class="qt-mono pdf-sig__mono">{{ verifyFor(sig)!.digestAlgorithm || '-' }}</code></dd>
              </div>
            </dl>
            <ul v-if="verifyFor(sig)!.errors.length" class="pdf-sig__errors">
              <li v-for="(err, i) in verifyFor(sig)!.errors" :key="i">{{ err }}</li>
            </ul>
          </template>
        </div>
      </div>

      <p v-if="backendAvailable === false && signatures.length > 0" class="qt-alert qt-alert--warn pdf-sig__warning--inline">
        <ShieldAlert :size="13" />
        <span>{{ t('tools.pdf-signature-checker.ui.backendUnavailable') }}</span>
      </p>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Dropzone icon — lifts + accents on hover/drag-over. */
.pdf-sig__drop-icon {
  color: var(--qt-muted);
  transition:
    transform 0.15s ease,
    color 0.15s ease;
}
.qt-drop:hover .pdf-sig__drop-icon,
.qt-drop--over .pdf-sig__drop-icon {
  color: var(--qt-accent);
  transform: translateY(-2px);
}
.pdf-sig__drop-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
/* Inline warning — extra top margin inside a card. */
.pdf-sig__warning--inline {
  margin-top: 8px;
}
/* Signature content card. */
.pdf-sig__card {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
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
/* Definition-list grid (2-col → 1-col). */
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
/* Mono value (font via .qt-mono). */
.pdf-sig__mono {
  font-size: 11.5px;
  word-break: break-all;
}
/* Valid/invalid icon colors. */
.pdf-sig__ok {
  color: var(--qt-success);
}
.pdf-sig__bad {
  color: var(--qt-danger);
}
/* Sub-section divider. */
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
/* Verification error list. */
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

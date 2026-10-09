<script setup lang="ts">
/**
 * UnicodePropertyExplorer - inspect code points, categories, scripts, blocks.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useUnicodePropertyExplorer } from './useUnicodePropertyExplorer';

const { input, codePoints, reset } = useUnicodePropertyExplorer();

const { t } = useI18n();
const U = 'tools.unicode-property-explorer.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="input"
        :label="t(U + 'inputText')"
        as="textarea"
        mono
        :rows="3"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCount', { n: codePoints.length })"
      hide-copy
    >
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div v-for="(cp, i) in codePoints" :key="i" class="qt-panel" style="padding:0;overflow:hidden">
          <div class="qt-row qt-row--center" style="--qt-row-gap:12px;flex-wrap:nowrap;padding:8px 12px;background:var(--qt-bg)">
            <span style="font-size:24px;line-height:1;min-width:32px;text-align:center">{{ cp.char === ' ' || cp.char === '\n' || cp.char === '\t' ? '·' : cp.char }}</span>
            <span class="qt-mono" style="font-size:12px;font-weight:600;color:var(--qt-muted)">{{ cp.hex }}</span>
          </div>
          <div class="qt-stack" style="--qt-stack-gap:4px;padding:8px 12px">
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px"><span style="font-weight:600;color:var(--qt-muted);min-width:60px">{{ t(U + 'lblName') }}</span><span style="color:var(--qt-text)">{{ cp.name }}</span></div>
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px"><span style="font-weight:600;color:var(--qt-muted);min-width:60px">{{ t(U + 'lblCategory') }}</span><span style="color:var(--qt-text)">{{ cp.category }}</span></div>
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px"><span style="font-weight:600;color:var(--qt-muted);min-width:60px">{{ t(U + 'lblBlock') }}</span><span style="color:var(--qt-text)">{{ cp.block }}</span></div>
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px"><span style="font-weight:600;color:var(--qt-muted);min-width:60px">{{ t(U + 'lblScript') }}</span><span style="color:var(--qt-text)">{{ cp.script }}</span></div>
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px">
              <span style="font-weight:600;color:var(--qt-muted);min-width:60px">{{ t(U + 'lblFlags') }}</span>
              <span style="color:var(--qt-text)">
                <span v-if="cp.isControl" class="qt-badge" style="font-size:10px;padding:1px 6px;margin-right:4px">{{ t(U + 'flagControl') }}</span>
                <span v-if="cp.isWhitespace" class="qt-badge" style="font-size:10px;padding:1px 6px;margin-right:4px">{{ t(U + 'flagWhitespace') }}</span>
                <span v-if="cp.isLetter" class="qt-badge" style="font-size:10px;padding:1px 6px;margin-right:4px">{{ t(U + 'flagLetter') }}</span>
                <span v-if="cp.isDigit" class="qt-badge" style="font-size:10px;padding:1px 6px;margin-right:4px">{{ t(U + 'flagDigit') }}</span>
                <span v-if="cp.isPunctuation" class="qt-badge" style="font-size:10px;padding:1px 6px;margin-right:4px">{{ t(U + 'flagPunctuation') }}</span>
                <span v-if="cp.isSymbol" class="qt-badge" style="font-size:10px;padding:1px 6px;margin-right:4px">{{ t(U + 'flagSymbol') }}</span>
              </span>
            </div>
            <div class="qt-row" v-if="cp.nfc !== cp.nfd" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px">
              <span style="font-weight:600;color:var(--qt-muted);min-width:60px">NFC</span><span style="color:var(--qt-text)">{{ cp.nfc }}</span>
            </div>
            <div class="qt-row" v-if="cp.nfc !== cp.nfd" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:12px">
              <span style="font-weight:600;color:var(--qt-muted);min-width:60px">NFD</span><span style="color:var(--qt-text)">{{ cp.nfd }}</span>
            </div>
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

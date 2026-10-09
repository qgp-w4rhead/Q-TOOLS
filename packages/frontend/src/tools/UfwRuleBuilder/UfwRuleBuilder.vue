<script setup lang="ts">
/**
 * UfwRuleBuilder - generate UFW firewall commands.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useUfwRuleBuilder, type UfwAction, type UfwDirection, type UfwProtocol } from './useUfwRuleBuilder';

const { config, output, update, addRule, removeRule, updateRule, reset } = useUfwRuleBuilder();

const { t } = useI18n();
const U = 'tools.ufw-rule-builder.ui.';

const ACTIONS: UfwAction[] = ['allow', 'deny', 'reject', 'limit'];
const DIRECTIONS: UfwDirection[] = ['in', 'out'];
const PROTOCOLS: UfwProtocol[] = ['tcp', 'udp', 'both'];
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div class="qt-row" style="--qt-row-gap:16px">
        <label class="qt-check"><input type="checkbox" :checked="config.defaultDenyIncoming" @change="update('defaultDenyIncoming', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'denyInLabel') }}</span></label>
        <label class="qt-check"><input type="checkbox" :checked="config.defaultAllowOutgoing" @change="update('defaultAllowOutgoing', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'allowOutLabel') }}</span></label>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between"><span class="qt-label">{{ t(U + 'rulesLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addRule">+ {{ t('common.add') }}</button></div>
        <div v-for="(r, i) in config.rules" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px">
          <select class="qt-input" style="width:auto" :value="r.action" @change="updateRule(i, 'action', ($event.target as HTMLSelectElement).value)">
            <option v-for="a in ACTIONS" :key="a" :value="a">{{ a }}</option>
          </select>
          <select class="qt-input" style="width:auto" :value="r.direction" @change="updateRule(i, 'direction', ($event.target as HTMLSelectElement).value)">
            <option v-for="d in DIRECTIONS" :key="d" :value="d">{{ d }}</option>
          </select>
          <ToolField v-model="r.port" mono :placeholder="t(U + 'phPort')" aria-label="Port" />
          <select class="qt-input" style="width:auto" :value="r.protocol" @change="updateRule(i, 'protocol', ($event.target as HTMLSelectElement).value)">
            <option v-for="p in PROTOCOLS" :key="p" :value="p">{{ p }}</option>
          </select>
          <ToolField v-model="r.sourceIp" mono :placeholder="t(U + 'phSourceIp')" grow aria-label="Source IP" />
          <ToolField v-model="r.service" :placeholder="t(U + 'phService')" grow aria-label="Service name" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeRule(i)">×</button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>

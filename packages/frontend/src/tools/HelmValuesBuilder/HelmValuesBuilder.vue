<script setup lang="ts">
/**
 * HelmValuesBuilder - form → Helm values.yaml.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import { useHelmValuesBuilder, type ServiceType } from './useHelmValuesBuilder';

const { config, output, update, addEnvVar, removeEnvVar, reset } = useHelmValuesBuilder();

const { t } = useI18n();
const U = 'tools.helm-values-builder.ui.';

const SERVICE_TYPES: ServiceType[] = ['ClusterIP', 'NodePort', 'LoadBalancer'];
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset"><RotateCcw :size="14" /><span>{{ t('common.reset') }}</span></ToolButton>
      </template>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secImage') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField
          :model-value="config.replicaCount"
          :label="t(U + 'replicaCountLabel')"
          type="number"
          min="1"
          @update:model-value="update('replicaCount', Number($event))"
        />
        <ToolField v-model="config.imageRepo" :label="t(U + 'imageRepoLabel')" />
        <ToolField v-model="config.imageTag" :label="t(U + 'imageTagLabel')" />
        <ToolField v-model="config.imagePullPolicy" :label="t(U + 'pullPolicyLabel')" />
      </div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow" style="min-width:100px"><span class="qt-label">{{ t(U + 'serviceTypeLabel') }}</span>
          <select class="qt-input" :value="config.serviceType" @change="update('serviceType', ($event.target as HTMLSelectElement).value as ServiceType)">
            <option v-for="t in SERVICE_TYPES" :key="t" :value="t">{{ t }}</option>
          </select></label>
        <ToolField
          :model-value="config.servicePort"
          :label="t(U + 'servicePortLabel')"
          type="number"
          @update:model-value="update('servicePort', Number($event))"
        />
        <ToolField
          :model-value="config.serviceTargetPort"
          :label="t(U + 'targetPortLabel')"
          type="number"
          @update:model-value="update('serviceTargetPort', Number($event))"
        />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secResources') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <ToolField v-model="config.resourcesRequestsCpu" :label="t(U + 'reqCpuLabel')" mono />
        <ToolField v-model="config.resourcesRequestsMemory" :label="t(U + 'reqMemLabel')" mono />
        <ToolField v-model="config.resourcesLimitsCpu" :label="t(U + 'limCpuLabel')" mono />
        <ToolField v-model="config.resourcesLimitsMemory" :label="t(U + 'limMemLabel')" mono />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secIngress') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-check"><input type="checkbox" :checked="config.ingressEnabled" @change="update('ingressEnabled', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'enableIngressLabel') }}</span></label>
        <ToolField v-model="config.ingressHost" :label="t(U + 'hostLabel')" />
        <ToolField v-model="config.ingressPath" :label="t(U + 'pathLabel')" />
        <ToolField v-model="config.ingressClassName" :label="t(U + 'ingressClassLabel')" />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secAutoscaling') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-check"><input type="checkbox" :checked="config.autoscalingEnabled" @change="update('autoscalingEnabled', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'enableHpaLabel') }}</span></label>
        <ToolField
          :model-value="config.autoscalingMinReplicas"
          :label="t(U + 'minReplicasLabel')"
          type="number"
          min="1"
          @update:model-value="update('autoscalingMinReplicas', Number($event))"
        />
        <ToolField
          :model-value="config.autoscalingMaxReplicas"
          :label="t(U + 'maxReplicasLabel')"
          type="number"
          min="1"
          @update:model-value="update('autoscalingMaxReplicas', Number($event))"
        />
        <ToolField
          :model-value="config.autoscalingTargetCpu"
          :label="t(U + 'targetCpuLabel')"
          type="number"
          min="1"
          max="100"
          @update:model-value="update('autoscalingTargetCpu', Number($event))"
        />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secPersistence') }}</div>
      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-check"><input type="checkbox" :checked="config.persistenceEnabled" @change="update('persistenceEnabled', ($event.target as HTMLInputElement).checked)" /> <span>{{ t(U + 'enableLabel') }}</span></label>
        <ToolField v-model="config.persistenceSize" :label="t(U + 'sizeLabel')" mono />
        <ToolField v-model="config.persistenceStorageClass" :label="t(U + 'storageClassLabel')" />
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-top:4px;border-top:1px solid var(--qt-border)">{{ t(U + 'secEnvVars') }}</div>
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px;align-self:flex-start" @click="addEnvVar">+ {{ t('common.add') }}</button>
        <div v-for="(e, i) in config.envVars" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
          <ToolField v-model="e.key" mono placeholder="KEY" aria-label="Env var key" />
          <span style="font-size:14px;font-weight:700;color:var(--qt-muted)">=</span>
          <ToolField v-model="e.value" mono placeholder="value" grow aria-label="Env var value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeEnvVar(i)">×</button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :copy-text="output" :copy-label="t(U + 'copyLabel')">
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>

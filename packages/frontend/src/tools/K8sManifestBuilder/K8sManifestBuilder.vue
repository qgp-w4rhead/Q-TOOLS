<script setup lang="ts">
/**
 * K8sManifestBuilder - form → Deployment + Service + Ingress YAML.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useK8sManifestBuilder,
  type K8sServiceType,
} from './useK8sManifestBuilder';

const {
  config,
  output,
  update,
  addEnvVar,
  removeEnvVar,
  addLabel,
  removeLabel,
  reset,
} = useK8sManifestBuilder();

const { t } = useI18n();
const U = 'tools.k8s-manifest-builder.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <!-- Deployment -->
      <h3 class="qt-row qt-row--center" style="--qt-row-gap:10px;margin:0;font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'secDeployment') }}</h3>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.deploymentName" :label="t(U + 'deployNameLabel')" grow />
        <ToolField
          :model-value="config.replicas"
          :label="t(U + 'replicasLabel')"
          type="number"
          min="0"
          @update:model-value="update('replicas', Number($event))"
        />
      </div>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.image" :label="t(U + 'imageLabel')" mono placeholder="nginx:1.25-alpine" grow />
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'pullPolicyLabel') }}</span>
          <select class="qt-input" :value="config.imagePullPolicy" @change="update('imagePullPolicy', ($event.target as HTMLSelectElement).value as 'Always' | 'IfNotPresent' | 'Never')">
            <option value="Always">Always</option>
            <option value="IfNotPresent">IfNotPresent</option>
            <option value="Never">Never</option>
          </select>
        </label>
      </div>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.containerName" :label="t(U + 'containerNameLabel')" />
        <ToolField
          :model-value="config.containerPort"
          :label="t(U + 'containerPortLabel')"
          type="number"
          min="1"
          max="65535"
          @update:model-value="update('containerPort', Number($event))"
        />
      </div>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.cpuRequest" :label="t(U + 'cpuReqLabel')" mono placeholder="100m" />
        <ToolField v-model="config.cpuLimit" :label="t(U + 'cpuLimLabel')" mono placeholder="500m" />
        <ToolField v-model="config.memoryRequest" :label="t(U + 'memReqLabel')" mono placeholder="128Mi" />
        <ToolField v-model="config.memoryLimit" :label="t(U + 'memLimLabel')" mono placeholder="256Mi" />
      </div>

      <!-- Env vars -->
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'envVarsLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addEnvVar">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(e, i) in config.envVars" :key="'env-' + i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <ToolField v-model="e.key" mono placeholder="KEY" aria-label="Environment key" />
          <ToolField v-model="e.value" mono placeholder="value" grow aria-label="Environment value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeEnvVar(i)">×</button>
        </div>
      </div>

      <!-- Service -->
      <h3 class="qt-row qt-row--center" style="--qt-row-gap:10px;margin:0;font-size:13px;font-weight:700;color:var(--qt-text)">{{ t(U + 'secService') }}</h3>
      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.serviceName" :label="t(U + 'serviceNameLabel')" grow />
        <label class="qt-field">
          <span class="qt-label">{{ t('common.type') }}</span>
          <select class="qt-input" :value="config.serviceType" @change="update('serviceType', ($event.target as HTMLSelectElement).value as K8sServiceType)">
            <option value="ClusterIP">ClusterIP</option>
            <option value="NodePort">NodePort</option>
            <option value="LoadBalancer">LoadBalancer</option>
          </select>
        </label>
        <ToolField
          :model-value="config.servicePort"
          :label="t(U + 'portLabel')"
          type="number"
          min="1"
          max="65535"
          @update:model-value="update('servicePort', Number($event))"
        />
        <ToolField
          :model-value="config.targetPort"
          :label="t(U + 'targetPortLabel')"
          type="number"
          min="1"
          max="65535"
          @update:model-value="update('targetPort', Number($event))"
        />
      </div>

      <!-- Ingress -->
      <h3 class="qt-row qt-row--center" style="--qt-row-gap:10px;margin:0;font-size:13px;font-weight:700;color:var(--qt-text)">
        {{ t(U + 'secIngress') }}
        <label class="qt-check" style="font-size:12px;font-weight:500">
          <input type="checkbox" :checked="config.ingressEnabled" @change="update('ingressEnabled', ($event.target as HTMLInputElement).checked)" />
          <span>{{ t(U + 'enabledLabel') }}</span>
        </label>
      </h3>
      <template v-if="config.ingressEnabled">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField v-model="config.ingressName" :label="t(U + 'ingressNameLabel')" grow />
          <ToolField v-model="config.ingressHost" :label="t(U + 'hostLabel')" placeholder="myapp.example.com" grow />
        </div>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField v-model="config.ingressPath" :label="t(U + 'pathLabel')" mono placeholder="/" grow />
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'pathTypeLabel') }}</span>
            <select class="qt-input" :value="config.ingressPathType" @change="update('ingressPathType', ($event.target as HTMLSelectElement).value as 'Prefix' | 'Exact' | 'ImplementationSpecific')">
              <option value="Prefix">Prefix</option>
              <option value="Exact">Exact</option>
              <option value="ImplementationSpecific">ImplementationSpecific</option>
            </select>
          </label>
        </div>
      </template>

      <!-- Labels -->
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'labelsLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addLabel">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(l, i) in config.labels" :key="'lbl-' + i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <ToolField v-model="l.key" mono placeholder="key" aria-label="Label key" />
          <ToolField v-model="l.value" mono placeholder="value" grow aria-label="Label value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeLabel(i)">×</button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="output"
      :copy-label="t(U + 'copyLabel')"
    >
      <pre class="qt-output" style="margin:0;max-height:60vh"><code>{{ output }}</code></pre>
    </ToolOutput>
  </div>
</template>

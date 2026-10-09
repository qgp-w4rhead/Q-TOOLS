<script setup lang="ts">
/**
 * TerraformResourceBuilder - form → HCL for AWS/Azure/GCP resources.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import {
  useTerraformResourceBuilder,
  type CloudProvider,
  type ResourceType,
} from './useTerraformResourceBuilder';

const {
  config,
  output,
  update,
  addTag,
  removeTag,
  reset,
} = useTerraformResourceBuilder();

const { t } = useI18n();
const U = 'tools.terraform-resource-builder.ui.';

const PROVIDERS: { value: CloudProvider; label: string }[] = [
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
  { value: 'gcp', label: 'GCP' },
];

const AWS_RESOURCES: { value: ResourceType; label: string }[] = [
  { value: 'aws_instance', label: 'aws_instance' },
  { value: 'aws_s3_bucket', label: 'aws_s3_bucket' },
  { value: 'aws_vpc', label: 'aws_vpc' },
  { value: 'aws_security_group', label: 'aws_security_group' },
  { value: 'aws_subnet', label: 'aws_subnet' },
  { value: 'aws_db_instance', label: 'aws_db_instance' },
];

const AZURE_RESOURCES: { value: ResourceType; label: string }[] = [
  { value: 'azurerm_linux_virtual_machine', label: 'azurerm_linux_virtual_machine' },
  { value: 'azurerm_storage_account', label: 'azurerm_storage_account' },
  { value: 'azurerm_resource_group', label: 'azurerm_resource_group' },
];

const GCP_RESOURCES: { value: ResourceType; label: string }[] = [
  { value: 'google_compute_instance', label: 'google_compute_instance' },
  { value: 'google_storage_bucket', label: 'google_storage_bucket' },
  { value: 'google_compute_network', label: 'google_compute_network' },
];

function resourceOptions(): { value: ResourceType; label: string }[] {
  if (config.value.provider === 'aws') return AWS_RESOURCES;
  if (config.value.provider === 'azure') return AZURE_RESOURCES;
  return GCP_RESOURCES;
}
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

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'providerLabel') }}</span>
          <select class="qt-input" :value="config.provider" @change="update('provider', ($event.target as HTMLSelectElement).value as CloudProvider)">
            <option v-for="p in PROVIDERS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'resourceTypeLabel') }}</span>
          <select class="qt-input" :value="config.resourceType" @change="update('resourceType', ($event.target as HTMLSelectElement).value as ResourceType)">
            <option v-for="r in resourceOptions()" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </label>
        <ToolField v-model="config.resourceName" :label="t(U + 'resourceNameLabel')" placeholder="web_server" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="config.region" :label="t(U + 'regionLabel')" placeholder="us-east-1" />
        <ToolField v-if="config.provider === 'gcp'" v-model="config.project" :label="t(U + 'projectLabel')" placeholder="my-project" />
        <ToolField v-if="config.provider === 'gcp'" v-model="config.zone" :label="t(U + 'zoneLabel')" placeholder="us-central1-a" />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px" v-if="config.resourceType === 'aws_instance' || config.resourceType === 'aws_db_instance'">
        <ToolField v-model="config.ami" label="AMI" mono placeholder="ami-0c55b159cbfafe1f0" grow />
        <ToolField v-model="config.instanceType" :label="t(U + 'instanceTypeLabel')" placeholder="t3.micro" />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px" v-if="config.resourceType === 'aws_s3_bucket' || config.resourceType === 'google_storage_bucket' || config.resourceType === 'azurerm_storage_account'">
        <ToolField v-model="config.bucketName" :label="t(U + 'bucketNameLabel')" placeholder="my-bucket" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px" v-if="config.resourceType === 'aws_vpc' || config.resourceType === 'aws_subnet'">
        <ToolField v-model="config.cidrBlock" :label="t(U + 'cidrLabel')" mono placeholder="10.0.0.0/16" grow />
      </div>

      <ToolField v-if="config.resourceType === 'aws_subnet' || config.resourceType === 'aws_security_group' || config.resourceType === 'aws_instance'" v-model="config.vpcId" :label="t(U + 'vpcIdLabel')" mono placeholder="vpc-xxxxx" grow />

      <div class="qt-row" style="--qt-row-gap:10px" v-if="config.resourceType === 'google_compute_instance'">
        <ToolField v-model="config.machineType" :label="t(U + 'machineTypeLabel')" placeholder="e2-medium" />
        <ToolField v-model="config.image" :label="t(U + 'imageLabel')" mono placeholder="debian-cloud/debian-12" grow />
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'tagsLabel') }}</span>
          <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px 10px;font-size:12px" @click="addTag">+ {{ t('common.add') }}</button>
        </div>
        <div v-for="(t, i) in config.tags" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <ToolField v-model="t.key" mono placeholder="Key" grow aria-label="Tag key" />
          <span style="font-size:14px;font-weight:700;color:var(--qt-muted)">=</span>
          <ToolField v-model="t.value" mono placeholder="value" grow aria-label="Tag value" />
          <button type="button" class="qt-btn qt-btn--ghost" style="flex-shrink:0;width:28px;height:28px;padding:0;color:var(--qt-danger);font-size:16px;line-height:1" @click="removeTag(i)">×</button>
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

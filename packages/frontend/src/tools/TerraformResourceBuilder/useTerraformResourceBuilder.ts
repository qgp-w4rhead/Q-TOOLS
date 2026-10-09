/**
 * useTerraformResourceBuilder - composable + pure logic for the Terraform
 * resource builder tool.
 *
 * Generates HCL for common AWS/Azure/GCP resources from form inputs.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type CloudProvider = 'aws' | 'azure' | 'gcp';
export type ResourceType =
  | 'aws_instance'
  | 'aws_s3_bucket'
  | 'aws_vpc'
  | 'aws_security_group'
  | 'aws_subnet'
  | 'aws_db_instance'
  | 'azurerm_linux_virtual_machine'
  | 'azurerm_storage_account'
  | 'azurerm_resource_group'
  | 'google_compute_instance'
  | 'google_storage_bucket'
  | 'google_compute_network';

export interface TerraformConfig {
  provider: CloudProvider;
  resourceType: ResourceType;
  resourceName: string;
  ami: string;
  instanceType: string;
  bucketName: string;
  cidrBlock: string;
  vpcId: string;
  subnetId: string;
  region: string;
  project: string;
  machineType: string;
  zone: string;
  image: string;
  diskSize: number;
  tags: { key: string; value: string }[];
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function defaultTerraformConfig(): TerraformConfig {
  return {
    provider: 'aws',
    resourceType: 'aws_instance',
    resourceName: 'web_server',
    ami: 'ami-0c55b159cbfafe1f0',
    instanceType: 't3.micro',
    bucketName: 'my-bucket',
    cidrBlock: '10.0.0.0/16',
    vpcId: '',
    subnetId: '',
    region: 'us-east-1',
    project: 'my-project',
    machineType: 'e2-medium',
    zone: 'us-central1-a',
    image: 'debian-cloud/debian-12',
    diskSize: 10,
    tags: [{ key: 'Environment', value: 'production' }],
  };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - HCL generation                                                 */
/* -------------------------------------------------------------------------- */

export function buildHcl(cfg: TerraformConfig): string {
  const out: string[] = [];

  // Provider block
  out.push(`terraform {`);
  out.push(`  required_providers {`);
  if (cfg.provider === 'aws') {
    out.push(`    aws = {`);
    out.push(`      source  = "hashicorp/aws"`);
    out.push(`      version = "~> 5.0"`);
    out.push(`    }`);
  } else if (cfg.provider === 'azure') {
    out.push(`    azurerm = {`);
    out.push(`      source  = "hashicorp/azurerm"`);
    out.push(`      version = "~> 3.0"`);
    out.push(`    }`);
  } else {
    out.push(`    google = {`);
    out.push(`      source  = "hashicorp/google"`);
    out.push(`      version = "~> 5.0"`);
    out.push(`    }`);
  }
  out.push(`  }`);
  out.push(`}`);
  out.push('');

  // Provider configuration
  if (cfg.provider === 'aws') {
    out.push(`provider "aws" {`);
    out.push(`  region = "${cfg.region}"`);
    out.push(`}`);
  } else if (cfg.provider === 'azure') {
    out.push(`provider "azurerm" {`);
    out.push(`  features {}`);
    out.push(`}`);
  } else {
    out.push(`provider "google" {`);
    out.push(`  project = "${cfg.project}"`);
    out.push(`  region  = "${cfg.region}"`);
    out.push(`}`);
  }
  out.push('');

  // Resource block
  const tagsHcl = cfg.tags.length
    ? cfg.tags
        .filter((t) => t.key)
        .map((t) => `    ${t.key} = "${t.value}"`)
        .join('\n')
    : '';

  switch (cfg.resourceType) {
    case 'aws_instance':
      out.push(`resource "aws_instance" "${cfg.resourceName}" {`);
      out.push(`  ami           = "${cfg.ami}"`);
      out.push(`  instance_type = "${cfg.instanceType}"`);
      if (cfg.subnetId) out.push(`  subnet_id     = "${cfg.subnetId}"`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'aws_s3_bucket':
      out.push(`resource "aws_s3_bucket" "${cfg.resourceName}" {`);
      out.push(`  bucket = "${cfg.bucketName}"`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'aws_vpc':
      out.push(`resource "aws_vpc" "${cfg.resourceName}" {`);
      out.push(`  cidr_block = "${cfg.cidrBlock}"`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'aws_security_group':
      out.push(`resource "aws_security_group" "${cfg.resourceName}" {`);
      if (cfg.vpcId) out.push(`  vpc_id = "${cfg.vpcId}"`);
      out.push(`  ingress {`);
      out.push(`    from_port   = 443`);
      out.push(`    to_port     = 443`);
      out.push(`    protocol    = "tcp"`);
      out.push(`    cidr_blocks = ["0.0.0.0/0"]`);
      out.push(`  }`);
      out.push(`  egress {`);
      out.push(`    from_port   = 0`);
      out.push(`    to_port     = 0`);
      out.push(`    protocol    = "-1"`);
      out.push(`    cidr_blocks = ["0.0.0.0/0"]`);
      out.push(`  }`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'aws_subnet':
      out.push(`resource "aws_subnet" "${cfg.resourceName}" {`);
      if (cfg.vpcId) out.push(`  vpc_id     = "${cfg.vpcId}"`);
      out.push(`  cidr_block = "${cfg.cidrBlock}"`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'aws_db_instance':
      out.push(`resource "aws_db_instance" "${cfg.resourceName}" {`);
      out.push(`  allocated_storage   = 20`);
      out.push(`  engine              = "postgres"`);
      out.push(`  engine_version      = "15"`);
      out.push(`  instance_class      = "${cfg.instanceType}"`);
      out.push(`  db_name             = "${cfg.resourceName}"`);
      out.push(`  username            = "admin"`);
      out.push(`  password            = "change-me"`);
      out.push(`  skip_final_snapshot = true`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'azurerm_linux_virtual_machine':
      out.push(`resource "azurerm_linux_virtual_machine" "${cfg.resourceName}" {`);
      out.push(`  name                  = "${cfg.resourceName}"`);
      out.push(`  resource_group_name   = "rg-${cfg.resourceName}"`);
      out.push(`  location              = "${cfg.region}"`);
      out.push(`  size                  = "${cfg.instanceType}"`);
      out.push(`  admin_username        = "adminuser"`);
      out.push(`  network_interface_ids = ["nic-${cfg.resourceName}-id"]`);
      out.push(`  admin_ssh_key {`);
      out.push(`    username   = "adminuser"`);
      out.push(`    public_key = "ssh-rsa AAAAB3..."`);
      out.push(`  }`);
      out.push(`  os_disk {`);
      out.push(`    caching              = "ReadWrite"`);
      out.push(`    storage_account_type = "Standard_LRS"`);
      out.push(`  }`);
      out.push(`  source_image_reference {`);
      out.push(`    publisher = "Canonical"`);
      out.push(`    offer     = "0001-com-ubuntu-server-jammy"`);
      out.push(`    sku       = "22_04-lts-gen2"`);
      out.push(`    version   = "latest"`);
      out.push(`  }`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'azurerm_storage_account':
      out.push(`resource "azurerm_storage_account" "${cfg.resourceName}" {`);
      out.push(`  name                     = "${cfg.bucketName}"`);
      out.push(`  resource_group_name      = "rg-${cfg.resourceName}"`);
      out.push(`  location                 = "${cfg.region}"`);
      out.push(`  account_tier             = "Standard"`);
      out.push(`  account_replication_type = "LRS"`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'azurerm_resource_group':
      out.push(`resource "azurerm_resource_group" "${cfg.resourceName}" {`);
      out.push(`  name     = "rg-${cfg.resourceName}"`);
      out.push(`  location = "${cfg.region}"`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'google_compute_instance':
      out.push(`resource "google_compute_instance" "${cfg.resourceName}" {`);
      out.push(`  name         = "${cfg.resourceName}"`);
      out.push(`  machine_type = "${cfg.machineType}"`);
      out.push(`  zone         = "${cfg.zone}"`);
      out.push(`  boot_disk {`);
      out.push(`    initialize_params {`);
      out.push(`      image = "${cfg.image}"`);
      out.push(`    }`);
      out.push(`  }`);
      out.push(`  network_interface {`);
      out.push(`    network = "default"`);
      out.push(`  }`);
      if (tagsHcl) {
        out.push(`  tags = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'google_storage_bucket':
      out.push(`resource "google_storage_bucket" "${cfg.resourceName}" {`);
      out.push(`  name     = "${cfg.bucketName}"`);
      out.push(`  location = "${cfg.region}"`);
      if (tagsHcl) {
        out.push(`  labels = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
    case 'google_compute_network':
      out.push(`resource "google_compute_network" "${cfg.resourceName}" {`);
      out.push(`  name = "${cfg.resourceName}"`);
      if (tagsHcl) {
        out.push(`  labels = {`);
        out.push(tagsHcl);
        out.push(`  }`);
      }
      out.push(`}`);
      break;
  }

  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseTerraformResourceBuilderReturn {
  config: Ref<TerraformConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof TerraformConfig>(key: K, value: TerraformConfig[K]) => void;
  addTag: () => void;
  removeTag: (index: number) => void;
  updateTag: (index: number, field: 'key' | 'value', value: string) => void;
  reset: () => void;
}

export function useTerraformResourceBuilder(): UseTerraformResourceBuilderReturn {
  const config = ref<TerraformConfig>(defaultTerraformConfig());

  const output = computed(() => buildHcl(config.value));

  function update<K extends keyof TerraformConfig>(key: K, value: TerraformConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addTag(): void {
    config.value = {
      ...config.value,
      tags: [...config.value.tags, { key: '', value: '' }],
    };
  }

  function removeTag(index: number): void {
    config.value = {
      ...config.value,
      tags: config.value.tags.filter((_, i) => i !== index),
    };
  }

  function updateTag(index: number, field: 'key' | 'value', value: string): void {
    const next = config.value.tags.map((t, i) =>
      i === index ? { ...t, [field]: value } : t,
    );
    config.value = { ...config.value, tags: next };
  }

  function reset(): void {
    config.value = defaultTerraformConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<TerraformConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return {
    config,
    output,
    isEmbed,
    embedInput,
    update,
    addTag,
    removeTag,
    updateTag,
    reset,
  };
}

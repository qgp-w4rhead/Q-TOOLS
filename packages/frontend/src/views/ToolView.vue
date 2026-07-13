<script setup lang="ts">
/**
 * ToolView — dynamic tool loader for the `/tools/:slug` child route.
 *
 * Mirrors `EmbedView.vue` but renders inside the full app shell (ToolLayout).
 * Tool modules are lazy-loaded by slug so each tool lands in its own Vite
 * chunk. Until a tool is implemented, the placeholder is shown so the route
 * never 404s.
 */
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { getToolBySlug } from '@/data/tools';
import ToolPlaceholder from './ToolPlaceholder.vue';

const props = defineProps<{ slug?: string }>();
const route = useRoute();

const resolvedSlug = computed(
  () => props.slug ?? (route.params.slug as string | undefined) ?? '',
);
const tool = computed(() => getToolBySlug(resolvedSlug.value));

const ToolComponent = defineAsyncComponent({
  loader: async () => {
    try {
      const mod = await loadToolModule(resolvedSlug.value);
      return mod.default ?? mod;
    } catch {
      return ToolPlaceholder;
    }
  },
  errorComponent: ToolPlaceholder,
  delay: 0,
});

async function loadToolModule(slug: string): Promise<{ default: unknown }> {
  // Vite needs literal specifiers to analyse dynamic imports. We enumerate
  // every tool module explicitly so code-splitting works per tool. Tools not
  // yet implemented are absent from this map → the catch above renders the
  // placeholder. Implemented tools are added here as they land.
  const modules: Record<string, () => Promise<{ default: unknown }>> = {
    'token-generator': () => import('@/tools/TokenGenerator/index'),
    'hash-text': () => import('@/tools/HashText/index'),
    'bcrypt': () => import('@/tools/Bcrypt/index'),
    'uuid-generator': () => import('@/tools/UuidGenerator/index'),
    'ulid-generator': () => import('@/tools/UlidGenerator/index'),
    'encrypt-decrypt-text': () => import('@/tools/EncryptDecrypt/index'),
    'bip39-generator': () => import('@/tools/Bip39Generator/index'),
    'hmac-generator': () => import('@/tools/HmacGenerator/index'),
    'rsa-key-pair-generator': () => import('@/tools/RsaKeyPair/index'),
    'password-strength-analyser': () => import('@/tools/PasswordStrength/index'),
    'pdf-signature-checker': () => import('@/tools/PdfSignature/index'),
    'date-time-converter': () => import('@/tools/DateTimeConverter/index'),
    'integer-base-converter': () => import('@/tools/BaseConverter/index'),
    'roman-numeral-converter': () => import('@/tools/RomanNumeralConverter/index'),
    'base64-string': () => import('@/tools/Base64String/index'),
    'base64-file-converter': () => import('@/tools/Base64File/index'),
    'color-converter': () => import('@/tools/ColorConverter/index'),
    'case-converter': () => import('@/tools/CaseConverter/index'),
    'text-to-nato': () => import('@/tools/NatoConverter/index'),
    'text-to-ascii-binary': () => import('@/tools/AsciiBinary/index'),
    'text-to-unicode': () => import('@/tools/TextToUnicode/index'),
    'yaml-to-json': () => import('@/tools/YamlToJson/index'),
    'yaml-to-toml': () => import('@/tools/YamlToToml/index'),
    'json-to-yaml': () => import('@/tools/JsonToYaml/index'),
    'json-to-toml': () => import('@/tools/JsonToToml/index'),
    'list-converter': () => import('@/tools/ListConverter/index'),
    'toml-to-json': () => import('@/tools/TomlToJson/index'),
    'toml-to-yaml': () => import('@/tools/TomlToYaml/index'),
    'xml-to-json': () => import('@/tools/XmlToJson/index'),
    'json-to-xml': () => import('@/tools/JsonToXml/index'),
    'markdown-to-html': () => import('@/tools/MarkdownToHtml/index'),
    'url-encode-decode': () => import('@/tools/UrlEncodeDecode/index'),
    'escape-html-entities': () => import('@/tools/EscapeHtmlEntities/index'),
    'url-parser': () => import('@/tools/UrlParser/index'),
    'device-information': () => import('@/tools/DeviceInformation/index'),
    'basic-auth-generator': () => import('@/tools/BasicAuthGenerator/index'),
    'open-graph-meta-generator': () => import('@/tools/OpenGraphMeta/index'),
    'otp-code-generator': () => import('@/tools/OtpCodeGenerator/index'),
    'mime-types': () => import('@/tools/MimeTypes/index'),
    'jwt-parser': () => import('@/tools/JwtParser/index'),
    'keycode-info': () => import('@/tools/KeycodeInfo/index'),
    // ...added in M1+ milestones
  };
  const loader = modules[slug];
  if (!loader) throw new Error(`tool not implemented: ${slug}`);
  return loader();
}
</script>

<template>
  <component :is="ToolComponent" v-if="tool" :slug="resolvedSlug" />
  <ToolPlaceholder v-else :slug="resolvedSlug" />
</template>

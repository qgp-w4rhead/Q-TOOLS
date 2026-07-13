<script setup lang="ts">
/**
 * Chromeless embed view for `/embed/tools/:slug`.
 *
 * Renders only the tool component — no sidebar, header, or app chrome. The
 * PostMessage protocol (input/output/resize) is wired up in M0.4 via the
 * `useEmbed()` composable; for now the view simply hosts the tool.
 *
 * Tools are lazy-loaded by slug. Until a tool is implemented (M1+), a
 * placeholder is shown so the route never 404s.
 */
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { getToolBySlug } from '@/data/tools';
import ToolPlaceholder from './ToolPlaceholder.vue';

const props = defineProps<{ slug?: string }>();
const route = useRoute();

const resolvedSlug = computed(() => props.slug ?? (route.params.slug as string | undefined) ?? '');
const tool = computed(() => getToolBySlug(resolvedSlug.value));

/**
 * Dynamic tool loader. Tool modules live at
 * `@/tools/<ToolName>/index.ts` and export a default Vue component. We map
 * slug → module path so each tool lands in its own Vite chunk. Until the
 * module exists the dynamic import rejects and we fall back to the
 * placeholder — this keeps the scaffold green across M0.
 */
const ToolComponent = defineAsyncComponent({
  loader: async () => {
    try {
      // The module map is populated as tools are implemented (M1+).
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
    'slugify-string': () => import('@/tools/SlugifyString/index'),
    'html-wysiwyg-editor': () => import('@/tools/HtmlWysiwygEditor/index'),
    'user-agent-parser': () => import('@/tools/UserAgentParser/index'),
    'http-status-codes': () => import('@/tools/HttpStatusCodes/index'),
    'json-diff': () => import('@/tools/JsonDiff/index'),
    'outlook-safelink-decoder': () => import('@/tools/OutlookSafelinkDecoder/index'),
    'qr-code-generator': () => import('@/tools/QrCodeGenerator/index'),
    'wifi-qr-code-generator': () => import('@/tools/WifiQrCodeGenerator/index'),
    'svg-placeholder-generator': () => import('@/tools/SvgPlaceholderGenerator/index'),
    'camera-recorder': () => import('@/tools/CameraRecorder/index'),
    'git-cheatsheet': () => import('@/tools/GitCheatsheet/index'),
    'random-port-generator': () =>
      import('@/tools/RandomPortGenerator/index'),
    'crontab-generator': () => import('@/tools/CrontabGenerator/index'),
    'json-prettify-and-format': () => import('@/tools/JsonPrettify/index'),
    'json-minify': () => import('@/tools/JsonMinify/index'),
    'json-to-csv': () => import('@/tools/JsonToCsv/index'),
    'sql-prettify-and-format': () => import('@/tools/SqlPrettify/index'),
    'chmod-calculator': () => import('@/tools/ChmodCalculator/index'),
    'docker-run-to-compose': () =>
      import('@/tools/DockerRunToCompose/index'),
    'xml-formatter': () => import('@/tools/XmlFormatter/index'),
    'yaml-prettify-and-format': () => import('@/tools/YamlPrettify/index'),
    'email-normalizer': () => import('@/tools/EmailNormalizer/index'),
    'regex-tester': () => import('@/tools/RegexTester/index'),
    'regex-cheatsheet': () => import('@/tools/RegexCheatsheet/index'),
    'ipv4-subnet-calculator': () =>
      import('@/tools/Ipv4SubnetCalculator/index'),
    'ipv4-address-converter': () =>
      import('@/tools/Ipv4AddressConverter/index'),
    'ipv4-range-expander': () =>
      import('@/tools/Ipv4RangeExpander/index'),
    'mac-address-lookup': () =>
      import('@/tools/MacAddressLookup/index'),
    'mac-address-generator': () =>
      import('@/tools/MacAddressGenerator/index'),
    'ipv6-ula-generator': () =>
      import('@/tools/Ipv6UlaGenerator/index'),
    'math-evaluator': () => import('@/tools/MathEvaluator/index'),
    'eta-calculator': () => import('@/tools/EtaCalculator/index'),
    'percentage-calculator': () =>
      import('@/tools/PercentageCalculator/index'),
    'chronometer': () => import('@/tools/Chronometer/index'),
    'temperature-converter': () =>
      import('@/tools/TemperatureConverter/index'),
    // ...added in M1+ milestones
  };
  const loader = modules[slug];
  if (!loader) throw new Error(`tool not implemented: ${slug}`);
  return loader();
}
</script>

<template>
  <div class="embed-view">
    <component :is="ToolComponent" v-if="tool" :slug="resolvedSlug" />
    <ToolPlaceholder v-else :slug="resolvedSlug" />
  </div>
</template>

<style scoped>
.embed-view {
  padding: 16px;
  min-height: 100vh;
  background: var(--qt-bg);
  color: var(--qt-text);
}
</style>

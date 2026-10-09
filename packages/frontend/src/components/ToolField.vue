<script setup lang="ts">
/**
 * ToolField - labelled input/textarea wrapper shared by tool components.
 *
 * Emits the global `.qt-field` / `.qt-label` / `.qt-input` utility classes
 * (see styles/utilities.css) and replaces the repeated
 * `<label class="x__field"><span class="x__label">…
 * <input class="x__input" :value="v" @input="onX">` pattern plus the
 * per-field `onX(e)` handler boilerplate:
 *
 *   <ToolField v-model="count" label="Count" type="number" min="1" />
 *   <ToolField v-model.number="count" label="Count" type="number" />
 *   <ToolField v-model="expr" label="Expression" as="textarea" :rows="3" mono />
 *
 * Supports the `v-model.number` and `v-model.trim` modifiers. Unknown attrs
 * (`min`, `max`, `step`, `inputmode`, `id`, `aria-label`, `class`, …) fall
 * through to the inner control element.
 */
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    /** Label text shown above the control. */
    label?: string;
    /** Render an <input> (default) or a <textarea>. */
    as?: 'input' | 'textarea';
    /** Input type attribute (ignored for textarea). */
    type?: string;
    /** Placeholder text. */
    placeholder?: string;
    /** Textarea row count. */
    rows?: number;
    /** Monospace font for the control. */
    mono?: boolean;
    /** Let the field grow to fill a flex row. */
    grow?: boolean;
  }>(),
  {
    label: '',
    as: 'input',
    type: 'text',
    placeholder: '',
    rows: 3,
    mono: false,
    grow: false,
  },
);

const [model, modifiers] = defineModel<string | number>();

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement | HTMLTextAreaElement;
  let value: string | number = el.value;
  if (modifiers.trim) value = value.trim();
  if (modifiers.number) {
    const n = parseFloat(value);
    value = Number.isNaN(n) ? value : n;
  }
  model.value = value;
}
</script>

<template>
  <label class="qt-field" :class="{ 'qt-field--grow': grow }">
    <span v-if="label" class="qt-label">{{ label }}</span>
    <textarea
      v-if="as === 'textarea'"
      class="qt-input"
      :class="{ 'qt-input--mono': mono }"
      :rows="rows"
      :placeholder="placeholder"
      :value="model"
      v-bind="$attrs"
      @input="onInput"
    />
    <input
      v-else
      :type="type"
      class="qt-input"
      :class="{ 'qt-input--mono': mono }"
      :placeholder="placeholder"
      :value="model"
      v-bind="$attrs"
      @input="onInput"
    />
  </label>
</template>

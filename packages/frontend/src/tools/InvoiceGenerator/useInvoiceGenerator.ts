/**
 * useInvoiceGenerator - composable + pure logic for invoice generation.
 *
 * The user enters invoice metadata (from, to, invoice number, date, due date),
 * line items (description, quantity, unit price), tax rate, and optional discount.
 * The composable computes subtotal, discount, tax, and total, and generates
 * a formatted HTML invoice string.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, computed, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface InvoiceLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  fromName: string;
  fromAddress: string;
  toName: string;
  toAddress: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  items: InvoiceLineItem[];
  taxRate: number;
  discountRate: number;
  notes: string;
}

export interface InvoiceTotals {
  ok: boolean;
  message?: string;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export function parseNumber(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function calculateTotals(
  items: InvoiceLineItem[],
  taxRate: number,
  discountRate: number,
): InvoiceTotals {
  if (items.length === 0) {
    return { ok: false, message: 'Add at least one line item.', subtotal: 0, discountAmount: 0, taxableAmount: 0, taxAmount: 0, total: 0 };
  }

  const subtotal = round2(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );

  const discountAmount = round2(subtotal * (discountRate / 100));
  const taxableAmount = round2(subtotal - discountAmount);
  const taxAmount = round2(taxableAmount * (taxRate / 100));
  const total = round2(taxableAmount + taxAmount);

  return {
    ok: true,
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    total,
  };
}

export function generateInvoiceHTML(data: InvoiceData, totals: InvoiceTotals): string {
  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.unitPrice)}</td>
        <td style="text-align:right">${formatCurrency(item.quantity * item.unitPrice)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${escapeHtml(data.invoiceNumber)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; margin: 0 0 20px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .party { margin-bottom: 20px; }
  .party-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
  .party-name { font-weight: 700; font-size: 15px; }
  .party-address { font-size: 13px; color: #555; white-space: pre-line; }
  .meta { font-size: 13px; }
  .meta-row { display: flex; gap: 8px; }
  .meta-label { color: #888; min-width: 100px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f5f5f5; padding: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 2px solid #ddd; }
  td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
  .totals { margin-left: auto; width: 300px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .totals-row--total { font-weight: 700; font-size: 18px; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 6px; }
  .notes { margin-top: 30px; font-size: 13px; color: #555; }
</style>
</head>
<body>
  <h1>Invoice</h1>
  <div class="header">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${escapeHtml(data.fromName)}</div>
      <div class="party-address">${escapeHtml(data.fromAddress)}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Invoice #</span><strong>${escapeHtml(data.invoiceNumber)}</strong></div>
      <div class="meta-row"><span class="meta-label">Date</span>${escapeHtml(data.date)}</div>
      <div class="meta-row"><span class="meta-label">Due date</span>${escapeHtml(data.dueDate)}</div>
    </div>
  </div>
  <div class="party">
    <div class="party-label">Bill To</div>
    <div class="party-name">${escapeHtml(data.toName)}</div>
    <div class="party-address">${escapeHtml(data.toAddress)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(totals.subtotal)}</span></div>
    ${data.discountRate > 0 ? `<div class="totals-row"><span>Discount (${data.discountRate}%)</span><span>-${formatCurrency(totals.discountAmount)}</span></div>` : ''}
    <div class="totals-row"><span>Tax (${data.taxRate}%)</span><span>${formatCurrency(totals.taxAmount)}</span></div>
    <div class="totals-row totals-row--total"><span>Total</span><span>${formatCurrency(totals.total)}</span></div>
  </div>
  ${data.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(data.notes)}</div>` : ''}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(n: number, symbol = '$'): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseInvoiceGeneratorReturn {
  data: Ref<InvoiceData>;
  totals: Ref<InvoiceTotals>;
  invoiceHTML: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
  addItem: () => void;
  removeItem: (id: number) => void;
  updateItem: (id: number, field: keyof InvoiceLineItem, value: string) => void;
}

export function useInvoiceGenerator(): UseInvoiceGeneratorReturn {
  const data = ref<InvoiceData>({
    fromName: '',
    fromAddress: '',
    toName: '',
    toAddress: '',
    invoiceNumber: '',
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    items: [{ id: 1, description: '', quantity: 1, unitPrice: 0 }],
    taxRate: 0,
    discountRate: 0,
    notes: '',
  });

  const totals = computed(() =>
    calculateTotals(data.value.items, data.value.taxRate, data.value.discountRate),
  );

  const invoiceHTML = computed(() => generateInvoiceHTML(data.value, totals.value));

  let nextId = 2;

  function reset(): void {
    data.value = {
      fromName: '',
      fromAddress: '',
      toName: '',
      toAddress: '',
      invoiceNumber: '',
      date: new Date().toISOString().slice(0, 10),
      dueDate: '',
      items: [{ id: 1, description: '', quantity: 1, unitPrice: 0 }],
      taxRate: 0,
      discountRate: 0,
      notes: '',
    };
    nextId = 2;
  }

  function addItem(): void {
    data.value.items.push({
      id: nextId++,
      description: '',
      quantity: 1,
      unitPrice: 0,
    });
  }

  function removeItem(id: number): void {
    if (data.value.items.length <= 1) return;
    data.value.items = data.value.items.filter((item) => item.id !== id);
  }

  function updateItem(id: number, field: keyof InvoiceLineItem, value: string): void {
    const item = data.value.items.find((it) => it.id === id);
    if (!item) return;
    if (field === 'description') {
      item.description = value;
    } else {
      const n = parseNumber(value);
      if (n !== null) {
        (item as Record<string, unknown>)[field] = n;
      }
    }
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.fromName === 'string') data.value.fromName = p.fromName;
      if (typeof p.toName === 'string') data.value.toName = p.toName;
      if (typeof p.invoiceNumber === 'string') data.value.invoiceNumber = p.invoiceNumber;
      if (typeof p.taxRate === 'string' || typeof p.taxRate === 'number') {
        data.value.taxRate = parseNumber(p.taxRate) ?? 0;
      }
      if (typeof p.discountRate === 'string' || typeof p.discountRate === 'number') {
        data.value.discountRate = parseNumber(p.discountRate) ?? 0;
      }
    },
    output: [totals, invoiceHTML],
    toOutput: () => ({ totals: totals.value, html: invoiceHTML.value }),
  });

  return {
    data,
    totals,
    invoiceHTML,
    isEmbed,
    embedInput,
    reset,
    addItem,
    removeItem,
    updateItem,
  };
}

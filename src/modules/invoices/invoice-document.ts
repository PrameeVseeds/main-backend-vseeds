export type InvoiceLayoutId = 'classic' | 'modern' | 'minimal';

export interface InvoiceTemplateSettings {
  layout: InvoiceLayoutId;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo: string | null;
  accentColor: string;
  notes: string;
  terms: string;
  taxLabel: string;
  signatureName: string;
  signatureTitle: string;
  showLogo: boolean;
  showNotes: boolean;
  showTerms: boolean;
  showSignature: boolean;
}

export const INVOICE_LAYOUTS: { id: InvoiceLayoutId; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Balanced header, bordered totals box' },
  { id: 'modern', name: 'Modern', description: 'Accent header band with dark meta strip' },
  { id: 'minimal', name: 'Minimal', description: 'Typographic, hairline rules, no boxes' },
];

export interface SampleInvoiceItem {
  no: number;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface SampleInvoiceData {
  invoiceId: string;
  date: string;
  dueDate: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  items: SampleInvoiceItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceTemplateSettings = {
  layout: 'classic',
  companyName: 'VSEEDS',
  companyAddress: 'No. 123, Main Street, Colombo, Sri Lanka',
  companyPhone: '+94 11 234 5678',
  companyEmail: 'info@vseeds.lk',
  companyLogo: null,
  accentColor: '#16a34a',
  notes: 'Thank you for your business. If you have any questions, please contact support.',
  terms: 'Payment is due within 14 days. Late payments may be subject to a surcharge.',
  taxLabel: 'Tax (18% VAT)',
  signatureName: 'Authorized Signatory',
  signatureTitle: 'VSEEDS Management',
  showLogo: true,
  showNotes: true,
  showTerms: true,
  showSignature: true,
};

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatStatus = (s: string | undefined): string => {
  if (!s) return 'Unpaid';
  const raw = String(s).toLowerCase().replace(/_/g, ' ');
  if ((raw.includes('paid') && !raw.includes('unpaid')) || raw.includes('completed') || raw.includes('succeeded') || raw.includes('successful') || raw.includes('done')) return 'Paid';
  if (raw.includes('unpaid')) return 'Unpaid';
  if (raw.includes('pending') || raw.includes('created') || raw.includes('waiting for payment')) return 'Pending';
  if (raw.includes('failed') || raw.includes('failure') || raw.includes('declined') || raw.includes('rejected')) return 'Failed';
  if (raw.includes('refunded')) return 'Refunded';
  if (raw.includes('cancelled')) return 'Cancelled';
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
};

const darken = (hex: string, amt = 48): string => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '#15803d';
  const ch = (i: number) => Math.max(0, Math.min(255, parseInt(m[i], 16) - amt));
  return `#${[ch(1), ch(2), ch(3)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

export function buildInvoiceCss(): string {
  return `
.inv-doc{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.inv-doc *{margin:0;padding:0;box-sizing:border-box}
.inv-doc .summary-row{margin-top:22px}
.inv-doc .items-table tr,.inv-doc .summary-row,.inv-doc .foot-grid,.inv-doc .signature,.inv-doc .totals-card,.inv-doc .notes-block,.inv-doc .terms-block{page-break-inside:avoid}
.inv-doc .summary-row,.inv-doc .foot-grid{page-break-before:avoid}
.inv-doc .b-name{font-weight:800;color:#0f172a}
.inv-doc table.items-table{width:100%;border-collapse:collapse;font-size:12px}
.inv-doc .c-no{width:36px;text-align:center}
.inv-doc .c-num{text-align:right}
.inv-doc .t-row{display:flex;justify-content:space-between;font-size:12px;color:#475569;padding:4px 0}
.inv-doc .t-grand span:last-child{font-weight:800}
.inv-doc .meta-label{display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:5px}
.inv-doc .sig-line{border-top:1px solid #94a3b8;margin-bottom:6px}
.inv-doc .sig-name{font-size:12px;font-weight:700;color:#0f172a}
.inv-doc .sig-title{font-size:10px;color:#64748b}
.inv-doc .notes-block p,.inv-doc .terms-block p{font-size:11px;color:#64748b;line-height:1.6;margin-top:6px}

/* ---------- Classic ---------- */
.inv-doc.l-classic .head{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #e2e8f0;margin-bottom:20px}
.inv-doc.l-classic .brand{display:flex;gap:14px;align-items:flex-start}
.inv-doc.l-classic .brand-logo-img{width:48px;height:48px;object-fit:contain;border-radius:12px;border:1px solid #e2e8f0}
.inv-doc.l-classic .brand-mark{width:48px;height:48px;border-radius:12px;background:#0f172a;color:#fff;font-weight:900;font-size:22px;display:flex;align-items:center;justify-content:center}
.inv-doc.l-classic .b-name{font-size:22px}
.inv-doc.l-classic .b-sub{font-size:11px;color:#64748b;margin-top:2px;line-height:1.5}
.inv-doc.l-classic .title-block{text-align:right}
.inv-doc.l-classic .title-block h1{font-size:24px;font-weight:800;letter-spacing:1.5px;color:#0f172a}
.inv-doc.l-classic .inv-id{font-size:13px;font-weight:700;color:var(--inv-accent);margin-top:4px}
.inv-doc.l-classic .meta-row{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}
.inv-doc.l-classic .meta-value{font-size:12px;color:#475569;line-height:1.6}
.inv-doc.l-classic .meta-value.strong{font-weight:700;color:#0f172a}
.inv-doc.l-classic .align-right{text-align:right}
.inv-doc.l-classic .m-line{display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#475569;margin-bottom:4px}
.inv-doc.l-classic .badge-unpaid{display:inline-block;padding:2px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:700;font-size:11px}
.inv-doc.l-classic .items-table th{background:#f1f5f9;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#334155;padding:11px 14px}
.inv-doc.l-classic .items-table th.c-num{text-align:right}
.inv-doc.l-classic .items-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;color:#334155}
.inv-doc.l-classic .summary-row{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;margin-bottom:20px}
.inv-doc.l-classic .totals-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;height:fit-content}
.inv-doc.l-classic .t-grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:9px;font-size:15px;font-weight:800;color:#0f172a}
.inv-doc.l-classic .foot-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:end;margin-top:8px;padding-top:18px;border-top:1px solid #e2e8f0}
.inv-doc.l-classic .signature{text-align:center}

/* ---------- Modern ---------- */
.inv-doc.l-modern .band{background:linear-gradient(120deg,var(--inv-accent),var(--inv-accent-dark));color:#fff;border-radius:14px;padding:26px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.inv-doc.l-modern .brand{display:flex;gap:14px;align-items:center}
.inv-doc.l-modern .brand-mark{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);color:#fff;font-weight:900;font-size:21px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.35)}
.inv-doc.l-modern .brand-logo-img{width:46px;height:46px;object-fit:contain;border-radius:12px;background:#fff;padding:3px;border:1px solid rgba(255,255,255,.5)}
.inv-doc.l-modern .b-name{font-size:21px;color:#fff}
.inv-doc.l-modern .b-sub{font-size:10.5px;color:rgba(255,255,255,.85);margin-top:2px;line-height:1.5}
.inv-doc.l-modern .title-block{text-align:right}
.inv-doc.l-modern .title-block h1{font-size:23px;font-weight:800;letter-spacing:2px;color:#fff}
.inv-doc.l-modern .inv-id{font-size:13px;font-weight:700;color:rgba(255,255,255,.92);margin-top:3px}
.inv-doc.l-modern .meta-strip{background:#0f172a;border-radius:12px;color:#fff;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 20px;margin-bottom:22px}
.inv-doc.l-modern .ms-cell .meta-label{color:#94a3b8;margin-bottom:3px}
.inv-doc.l-modern .ms-cell .ms-val{font-size:12px;font-weight:700}
.inv-doc.l-modern .ms-cell .pill{display:inline-block;padding:2px 10px;border-radius:999px;background:var(--inv-accent);color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
.inv-doc.l-modern .bill-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:20px}
.inv-doc.l-modern .bill-card .meta-value{font-size:12px;color:#475569;line-height:1.6}
.inv-doc.l-modern .bill-card .meta-value.strong{font-weight:700;color:#0f172a}
.inv-doc.l-modern .items-table th{background:#0f172a;color:#fff;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:12px 14px}
.inv-doc.l-modern .items-table th:first-child{border-radius:8px 0 0 0}
.inv-doc.l-modern .items-table th:last-child{border-radius:0 8px 0 0;text-align:right}
.inv-doc.l-modern .items-table td{padding:11px 14px;color:#334155;border-bottom:1px solid #f1f5f9}
.inv-doc.l-modern .items-table tr:nth-child(even) td{background:#fafafa}
.inv-doc.l-modern .summary-row{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;margin-bottom:22px}
.inv-doc.l-modern .t-grand{border-top:2px solid var(--inv-accent);margin-top:6px;padding-top:9px;font-size:15px;font-weight:800;color:#0f172a}
.inv-doc.l-modern .foot-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:end;padding-top:18px;border-top:1px dashed #cbd5e1}
.inv-doc.l-modern .signature{text-align:right}
.inv-doc.l-modern .sig-line{margin-left:auto;width:180px}

/* ---------- Minimal ---------- */
.inv-doc.l-minimal .head{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:16px;border-bottom:3px solid #0f172a;margin-bottom:26px}
.inv-doc.l-minimal .min-left h1{font-size:34px;font-weight:800;letter-spacing:-.5px;color:#0f172a;line-height:1}
.inv-doc.l-minimal .inv-id{font-size:12px;font-weight:600;color:var(--inv-accent);margin-top:6px;letter-spacing:.5px;text-transform:uppercase}
.inv-doc.l-minimal .brand{display:flex;gap:10px;align-items:flex-start;text-align:right;flex-direction:row-reverse}
.inv-doc.l-minimal .brand-logo-img{width:40px;height:40px;object-fit:contain;border-radius:8px;border:1px solid #e2e8f0}
.inv-doc.l-minimal .brand-mark{width:40px;height:40px;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center}
.inv-doc.l-minimal .b-name{font-size:15px}
.inv-doc.l-minimal .b-sub{font-size:10px;color:#64748b;line-height:1.55;margin-top:2px}
.inv-doc.l-minimal .meta-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:30px}
.inv-doc.l-minimal .meta-value{font-size:12px;color:#475569;line-height:1.7}
.inv-doc.l-minimal .meta-value.strong{font-weight:700;color:#0f172a}
.inv-doc.l-minimal .align-right{text-align:right}
.inv-doc.l-minimal .status-plain{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--inv-accent)}
.inv-doc.l-minimal .m-def{display:flex;gap:8px;font-size:11px;color:#64748b;margin-bottom:3px}
.inv-doc.l-minimal .m-def b{color:#0f172a;font-weight:600;min-width:70px;text-align:right}
.inv-doc.l-minimal .items-table thead th{border-top:2px solid #0f172a;border-bottom:1px solid #cbd5e1;text-align:left;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#334155;padding:10px 6px}
.inv-doc.l-minimal .items-table thead th.c-num{text-align:right}
.inv-doc.l-minimal .items-table td{padding:12px 6px;border-bottom:1px solid #eef2f6;color:#334155}
.inv-doc.l-minimal .summary-row{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;margin-bottom:26px}
.inv-doc.l-minimal .totals-plain .t-row{padding:5px 0;border-bottom:1px dotted #e2e8f0}
.inv-doc.l-minimal .t-grand{border-bottom:2px solid var(--inv-accent)!important;font-size:14px;font-weight:800;color:#0f172a}
.inv-doc.l-minimal .foot-grid{display:grid;grid-template-columns:1fr auto;gap:32px;align-items:end;margin-top:6px}
.inv-doc.l-minimal .signature{text-align:right}

@media print{
  .inv-doc{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
`.trim();
}

function brandLogoHtml(s: InvoiceTemplateSettings): string {
  if (!s.showLogo) return '';
  return s.companyLogo
    ? `<img class="brand-logo-img" src="${esc(s.companyLogo)}" alt="logo" />`
    : `<div class="brand-mark">${esc((s.companyName || 'V').charAt(0).toUpperCase())}</div>`;
}

function itemsRowsHtml(sample: SampleInvoiceData): string {
  return sample.items
    .map(
      (it) => `
        <tr>
          <td class="c-no">${it.no}</td>
          <td>${esc(it.name)}</td>
          <td class="c-num">${it.qty}</td>
          <td class="c-num">Rs. ${fmt(it.unitPrice)}</td>
          <td class="c-num">Rs. ${fmt(it.total)}</td>
        </tr>`,
    )
    .join('');
}

function totalsRowsHtml(s: InvoiceTemplateSettings, sample: SampleInvoiceData): string {
  return `
        <div class="t-row"><span>Subtotal</span><span>Rs. ${fmt(sample.subtotal)}</span></div>
        <div class="t-row"><span>${esc(s.taxLabel)}</span><span>Rs. ${fmt(sample.tax)}</span></div>
        <div class="t-row"><span>Shipping</span><span>Rs. ${fmt(sample.shipping)}</span></div>
        <div class="t-row t-grand"><span>Total</span><span>Rs. ${fmt(sample.total)}</span></div>`;
}

export function buildInvoiceBody(s: InvoiceTemplateSettings, sample: SampleInvoiceData): string {
  const logo = brandLogoHtml(s);
  const itemsRows = itemsRowsHtml(sample);
  const totalsRows = totalsRowsHtml(s, sample);

  let head = '';
  let meta = '';
  let totalsWrapOpen = '<div class="totals-card">';
  let totalsWrapClose = '</div>';

  if (s.layout === 'modern') {
    head = `
      <header class="band">
        <div class="brand">
          ${logo}
          <div>
            <div class="b-name">${esc(s.companyName)}</div>
            <div class="b-sub">${esc(s.companyAddress)}<br>${esc(s.companyPhone)} &middot; ${esc(s.companyEmail)}</div>
          </div>
        </div>
        <div class="title-block">
          <h1>INVOICE</h1>
          <div class="inv-id">#${esc(sample.invoiceId)}</div>
        </div>
      </header>
      <div class="meta-strip">
        <div class="ms-cell"><span class="meta-label">Invoice No</span><span class="ms-val">${esc(sample.invoiceId)}</span></div>
        <div class="ms-cell"><span class="meta-label">Invoice Date</span><span class="ms-val">${esc(sample.date)}</span></div>
        <div class="ms-cell"><span class="meta-label">Due Date</span><span class="ms-val">${esc(sample.dueDate)}</span></div>
        <div class="ms-cell"><span class="meta-label">Status</span><span class="pill">${esc(formatStatus(sample.status))}</span></div>
      </div>
      <div class="bill-card">
        <span class="meta-label">Billed To</span>
        <div class="meta-value strong">${esc(sample.customerName)}</div>
        <div class="meta-value">${esc(sample.customerEmail)} &middot; ${esc(sample.customerPhone)}</div>
      </div>`;
    meta = '';
  } else if (s.layout === 'minimal') {
    head = `
      <header class="head">
        <div class="min-left">
          <h1>INVOICE</h1>
          <div class="inv-id">#${esc(sample.invoiceId)} &middot; ${esc(sample.orderNumber)}</div>
        </div>
        <div class="brand">
          ${logo}
          <div class="brand-txt">
            <div class="b-name">${esc(s.companyName)}</div>
            <div class="b-sub">${esc(s.companyAddress)}<br>${esc(s.companyPhone)}<br>${esc(s.companyEmail)}</div>
          </div>
        </div>
      </header>`;
    meta = `
      <section class="meta-row">
        <div>
          <span class="meta-label">Billed To</span>
          <div class="meta-value strong">${esc(sample.customerName)}</div>
          <div class="meta-value">${esc(sample.customerEmail)}</div>
          <div class="meta-value">${esc(sample.customerPhone)}</div>
        </div>
        <div class="align-right">
          <span class="meta-label">Details</span>
          <div class="m-def"><span>Date</span><b>${esc(sample.date)}</b></div>
          <div class="m-def"><span>Due Date</span><b>${esc(sample.dueDate)}</b></div>
          <div class="m-def"><span>Status</span><b class="status-plain">${esc(formatStatus(sample.status))}</b></div>
        </div>
      </section>`;
    totalsWrapOpen = '<div class="totals-plain">';
    totalsWrapClose = '</div>';
  } else {
    head = `
      <header class="head">
        <div class="brand">
          ${logo}
          <div>
            <div class="b-name">${esc(s.companyName)}</div>
            <div class="b-sub">${esc(s.companyAddress)}<br>${esc(s.companyPhone)} &middot; ${esc(s.companyEmail)}</div>
          </div>
        </div>
        <div class="title-block">
          <h1>INVOICE</h1>
          <div class="inv-id">#${esc(sample.invoiceId)}</div>
        </div>
      </header>`;
    meta = `
      <section class="meta-row">
        <div>
          <span class="meta-label">Billed To</span>
          <div class="meta-value strong">${esc(sample.customerName)}</div>
          <div class="meta-value">${esc(sample.customerEmail)}</div>
          <div class="meta-value">${esc(sample.customerPhone)}</div>
        </div>
        <div class="align-right">
          <div class="m-line"><span class="meta-label" style="margin:0">Invoice Date</span><span>${esc(sample.date)}</span></div>
          <div class="m-line"><span class="meta-label" style="margin:0">Due Date</span><span>${esc(sample.dueDate)}</span></div>
          <div class="m-line"><span class="meta-label" style="margin:0">Order #</span><span>${esc(sample.orderNumber)}</span></div>
          <div class="m-line"><span class="meta-label" style="margin:0">Status</span><span class="badge-unpaid">${esc(formatStatus(sample.status))}</span></div>
        </div>
      </section>`;
  }

  const notesBlock = s.showNotes
    ? `
        <div class="notes-block">
          <span class="meta-label">Notes</span>
          <p>${esc(s.notes)}</p>
        </div>`
    : '';

  const footLeft = s.showTerms
    ? `
        <div class="terms-block">
          <span class="meta-label">Terms &amp; Conditions</span>
          <p>${esc(s.terms)}</p>
        </div>`
    : '';

  const signature = s.showSignature
    ? `
        <div class="signature">
          <div class="sig-line"></div>
          <div class="sig-name">${esc(s.signatureName)}</div>
          <div class="sig-title">${esc(s.signatureTitle)}</div>
        </div>`
    : '';

  const footGrid =
    footLeft.trim() || signature.trim()
      ? `
      <section class="foot-grid">${footLeft}${signature}</section>`
      : '';

  return `
    <div class="inv-doc l-${esc(s.layout)}">${head}${meta}
      <table class="items-table">
        <thead><tr><th class="c-no">#</th><th>Description</th><th class="c-num">Qty</th><th class="c-num">Unit Price</th><th class="c-num">Amount</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <section class="summary-row">${notesBlock}
        ${totalsWrapOpen}${totalsRows}${totalsWrapClose}
      </section>${footGrid}
    </div>`;
}

export function buildInvoiceDocument(s: InvoiceTemplateSettings, sample: SampleInvoiceData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice Sample - ${esc(s.companyName)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#fff;padding:36px;max-width:800px;margin:0 auto}
        :root{--inv-accent:${esc(s.accentColor || '#16a34a')};--inv-accent-dark:${esc(darken(s.accentColor))}}
        ${buildInvoiceCss()}
        @media print{body{padding:0;max-width:100%}@page{size:A4;margin:12mm}}
      </style></head><body>${buildInvoiceBody(s, sample)}</body></html>`;
}

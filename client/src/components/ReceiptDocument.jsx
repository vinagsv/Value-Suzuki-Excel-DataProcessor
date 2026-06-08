import React from 'react';
import tailwindStyles from '../index.css?inline';

// ── Layout constants (A4 proportions) ─────────────────────────────────────────
export const A4_W_PX          = 794;
export const PAGE_PAD_PX      = Math.round((5 / 210) * A4_W_PX);
export const RECEIPT_W_PX     = A4_W_PX - PAGE_PAD_PX * 2;
export const RECEIPT_H_PX     = Math.round((120 / 297) * 1123);
const        LABEL_H_PX       = 20;
export const PREVIEW_NATURAL_H = RECEIPT_H_PX + LABEL_H_PX + 8;

// ── Helpers (single source of truth — imported by Receipt.jsx) ────────────────
/**
 * Converts a YYYY-MM-DD string to DD-MM-YYYY for display.
 * Separator is a hyphen so dates read naturally on the receipt.
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.substring(0, 10).split('-');
  return `${day}-${month}-${year}`;
};

/** Returns true when a field has a non-empty, non-whitespace value. */
const hasValue = (val) => val && String(val).trim().length > 0;

// ── buildReceiptHtmlString ────────────────────────────────────────────────────
/**
 * Returns a self-contained HTML *string* for a single receipt copy.
 * Used by the mobile print path (writes into a new window).
 *
 * @param {object} args
 * @param {object} args.formData
 * @param {string} args.currentFilePrefix
 * @param {string|null} args.qrDataUrl
 * @param {boolean} args.qrEnabled
 * @param {string} args.amountInWords  – pre-computed "FIFTY THOUSAND ONLY" etc.
 */
export const buildReceiptHtmlString = ({
  formData,
  currentFilePrefix,
  qrDataUrl,
  qrEnabled,
  amountInWords,
}) => {
  const fd               = formData;
  const fullFileNo       = currentFilePrefix + fd.fileNoSeq;
  const showFileNo       = hasValue(fd.fileNoSeq);
  const finalPaymentType = fd.paymentType === 'Other' ? fd.customPaymentType : fd.paymentType;
  const amountFormatted  = Number(fd.amount).toLocaleString('en-IN');
  // Respect qrEnabled flag — if disabled, never show QR regardless of qrDataUrl
  const effectiveQrUrl   = qrEnabled ? qrDataUrl : null;

  const cancelledOverlay = fd.status === 'CANCELLED' ? `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:50;pointer-events:none;">
      <div style="border:4px solid rgba(239,68,68,0.3);color:rgba(239,68,68,0.3);font-size:64px;font-weight:900;transform:rotate(-45deg);padding:16px;border-radius:12px;letter-spacing:0.1em;user-select:none;line-height:1;">CANCELLED</div>
    </div>` : '';

  const fileNoHtml = showFileNo ? `
    <div style="font-size:13px;font-weight:bold;color:#1f2937;">File Number: <span style="margin-left:4px;">${fullFileNo}</span></div>` : '';

  const modelHtml = hasValue(fd.model) ? `
    <div style="display:flex;align-items:flex-end;">
      <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">MODEL:</span>
      <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;text-transform:uppercase;min-width:120px;text-align:center;">${fd.model}</span>
    </div>` : '';

  const hpHtml = hasValue(fd.hp) ? `
    <div style="display:flex;align-items:flex-end;">
      <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">H.P. TO:</span>
      <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:13px;text-transform:uppercase;min-width:150px;text-align:center;">${fd.hp}</span>
    </div>` : '';

  const mobileHtml = hasValue(fd.mobile) ? `
    <div style="display:flex;align-items:flex-end;">
      <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">MOBILE NO:</span>
      <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;min-width:150px;text-align:center;">${fd.mobile}</span>
    </div>` : '';

  const datedHtml = hasValue(fd.dated) ? `
    <div style="font-weight:bold;font-size:12px;">DATED: <span style="margin-left:4px;">${formatDate(fd.dated)}</span></div>` : '';

  const chequeHtml = hasValue(fd.chequeNo) ? `
    <div style="font-style:italic;">Cheque/Ref No: <span style="font-weight:bold;">${fd.chequeNo}</span></div>` : '';

  const remarksHtml = hasValue(fd.remarks) ? `
    <div style="word-break:break-word;white-space:pre-wrap;line-height:1.2;">REMARKS: <span style="font-weight:bold;">${fd.remarks}</span></div>` : '';

  const extraFinanceHtml = (hasValue(fd.chequeNo) || hasValue(fd.remarks)) ? `
    <div style="display:flex;flex-direction:column;font-size:12px;font-weight:600;gap:2px;margin-top:4px;">
      ${chequeHtml}${remarksHtml}
    </div>` : '';

  const logoSrc   = `${window.location.origin}/suzuki-logo.png`;
  const qrSection = effectiveQrUrl ? `
    <div style="position:absolute;right:0;top:0;display:flex;flex-direction:column;align-items:center;z-index:20;background-color:white;padding:0 0 2mm 2mm;border-radius:4px;">
      <img src="${effectiveQrUrl}" alt="QR" style="width:64px;height:64px;display:block;" />
    </div>` : '';

  return `
    <div style="position:relative;width:100%;height:100%;box-sizing:border-box;padding:4mm;display:flex;flex-direction:column;overflow:hidden;font-family:sans-serif;color:black;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      ${cancelledOverlay}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.07;z-index:0;">
        <img src="${logoSrc}" alt="" style="width:66%;" />
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;position:relative;z-index:10;">
        <div style="width:45%;">
          <img src="${logoSrc}" alt="Suzuki" style="width:180px;max-width:100%;" />
          <div style="font-weight:bold;margin-top:2px;font-size:12px;">GST NO: 29AACCV2521J1ZA</div>
        </div>
        <div style="width:55%;text-align:right;">
          <h1 style="font-size:19px;font-weight:900;text-transform:uppercase;line-height:1.2;margin:0;">VALUE MOTOR AGENCY PVT LTD</h1>
          <p style="font-size:9px;font-weight:bold;margin-top:2px;letter-spacing:0.04em;margin:2px 0 0;">#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
          <p style="font-size:9px;font-weight:bold;letter-spacing:0.04em;margin:1px 0 0;">Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
        </div>
      </div>
      <div style="border-bottom:2px solid black;text-align:center;margin-bottom:3px;padding-bottom:1px;position:relative;z-index:10;">
        <span style="font-size:20px;font-weight:bold;text-transform:uppercase;letter-spacing:0.2em;">RECEIPT</span>
      </div>
      <div style="position:relative;z-index:10;">
        ${qrSection}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:13px;font-weight:bold;">
          <div>NO: <span style="color:#dc2626;font-size:18px;margin-left:8px;">${fd.receiptNo}</span></div>
          <div style="display:flex;align-items:center;gap:20px;padding-right:${effectiveQrUrl ? '85px' : '0'};">
            ${fileNoHtml}
            <div>DATE: <span style="margin-left:8px;font-size:15px;">${formatDate(fd.date)}</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:2px;">
          <div style="line-height:26px;min-height:26px;margin-right:${effectiveQrUrl ? '85px' : '0'};word-break:break-word;">
            <span style="font-weight:bold;font-size:13px;padding-bottom:1px;margin-right:8px;display:inline;">RECEIVED WITH THANKS FROM:</span>
            <span style="font-weight:900;font-size:18px;text-transform:uppercase;color:#1e3a8a;border-bottom:1px dotted black;padding:0 8px 1px;display:inline;line-height:1.4;">${fd.customerName}</span>
          </div>
          <div style="line-height:28px;min-height:28px;word-break:break-word;margin-top:1px;">
            <span style="font-weight:bold;font-size:12px;letter-spacing:0.04em;padding-bottom:1px;margin-right:8px;display:inline;">THE SUM OF RUPEES:</span>
            <span style="font-weight:bold;font-size:17px;font-style:italic;text-transform:uppercase;border-bottom:1px dotted black;padding:0 8px 1px;display:inline;line-height:1.4;">${amountInWords}</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;">
            ${modelHtml}
            <div style="display:flex;align-items:flex-end;">
              <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">ON ACCOUNT OF:</span>
              <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;text-transform:uppercase;min-width:120px;text-align:center;">${finalPaymentType}</span>
            </div>
            <div style="display:flex;align-items:flex-end;">
              <span style="font-weight:bold;margin-right:6px;white-space:nowrap;font-size:11px;">BY WAY OF:</span>
              <span style="border-bottom:1px dotted black;padding:0 8px;font-weight:bold;font-size:14px;text-transform:uppercase;min-width:120px;text-align:center;">${fd.paymentMode}</span>
            </div>
          </div>
          ${hpHtml}
          ${mobileHtml}
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:10;">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;">
          <div style="display:flex;flex-direction:column;gap:3px;flex:1;padding-right:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="border:2px solid black;padding:4px 14px;font-size:21px;font-weight:900;background-color:#f9fafb;white-space:nowrap;letter-spacing:0.05em;line-height:1;">
                ₹ ${amountFormatted}/-
              </div>
              ${datedHtml}
            </div>
            ${extraFinanceHtml}
          </div>
          <div style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex-shrink:0;">
            <div style="font-size:11px;margin-bottom:2px;letter-spacing:0.04em;">
              <span style="font-weight:500;">For</span>
              <span style="font-weight:bold;text-transform:uppercase;font-size:11px;"> VALUE MOTOR AGENCY PVT LTD</span>
            </div>
            <div style="height:12mm;width:100%;"></div>
            <div style="font-size:11px;border-top:2px solid black;display:inline-block;padding:2px 28px 0;font-weight:bold;letter-spacing:0.04em;">
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:4px;padding-top:3px;border-top:1px solid #9ca3af;position:relative;z-index:10;">
        <div style="font-size:9px;font-weight:900;color:#1f2937;text-transform:uppercase;line-height:1.3;letter-spacing:0.04em;">
          WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 | BRANCH: VASANTHNAGAR
        </div>
        <div style="font-size:8.5px;font-weight:900;color:black;text-transform:uppercase;margin-top:2px;letter-spacing:0.04em;line-height:1.2;">
          <div>CHEQUES SUBJECT TO REALISATION. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.</div>
          <div>PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE.</div>
        </div>
      </div>
    </div>`;
};

// ── ReceiptBody (React version) ───────────────────────────────────────────────
/**
 * Renders a single receipt copy as React elements.
 * Used by both the live preview and the desktop print target.
 */
export const ReceiptBody = ({ formData, currentFilePrefix, qrDataUrl, qrEnabled, amountInWords }) => {
  const fd               = formData;
  const fullFileNo       = currentFilePrefix + fd.fileNoSeq;
  const finalPaymentType = fd.paymentType === 'Other' ? fd.customPaymentType : fd.paymentType;
  // Respect qrEnabled flag — if disabled, never show QR regardless of qrDataUrl
  const effectiveQrUrl   = qrEnabled ? qrDataUrl : null;

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      boxSizing: 'border-box', padding: '4mm',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    }}>
      {/* CANCELLED watermark */}
      {fd.status === 'CANCELLED' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, pointerEvents: 'none' }}>
          <div style={{ border: '4px solid rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.3)', fontSize: '64px', fontWeight: 900, transform: 'rotate(-45deg)', padding: '16px', borderRadius: '12px', letterSpacing: '0.1em', userSelect: 'none', lineHeight: 1 }}>
            CANCELLED
          </div>
        </div>
      )}

      {/* Watermark logo */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.07, zIndex: 0 }}>
        <img src="/suzuki-logo.png" alt="" style={{ width: '66%' }} />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px', position: 'relative', zIndex: 10 }}>
        <div style={{ width: '45%' }}>
          <img src="/suzuki-logo.png" alt="Suzuki" style={{ width: '180px', maxWidth: '100%' }} />
          <div style={{ fontWeight: 'bold', marginTop: '2px', fontSize: '12px' }}>GST NO: 29AACCV2521J1ZA</div>
        </div>
        <div style={{ width: '55%', textAlign: 'right' }}>
          <h1 style={{ fontSize: '19px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, margin: 0 }}>VALUE MOTOR AGENCY PVT LTD</h1>
          <p style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px', letterSpacing: '0.04em', margin: '2px 0 0' }}>#16/A, MILLERS ROAD, VASANTH NAGAR, BANGALORE - 52</p>
          <p style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.04em', margin: '1px 0 0' }}>Mob: 9845906084 | Email: millers_road_suzuki@yahoo.com</p>
        </div>
      </div>

      {/* Title bar */}
      <div style={{ borderBottom: '2px solid black', textAlign: 'center', marginBottom: '3px', paddingBottom: '1px', position: 'relative', zIndex: 10 }}>
        <span style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.2em' }}>RECEIPT</span>
      </div>

      {/* Body */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {effectiveQrUrl && (
          <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20, backgroundColor: 'white', padding: '0 0 2mm 2mm', borderRadius: '4px' }}>
            <img src={effectiveQrUrl} alt="QR" style={{ width: '64px', height: '64px', display: 'block' }} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
          <div>NO: <span style={{ color: '#dc2626', fontSize: '18px', marginLeft: '8px' }}>{fd.receiptNo}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingRight: effectiveQrUrl ? '85px' : '0' }}>
            {hasValue(fd.fileNoSeq) && (
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>
                File Number: <span style={{ marginLeft: '4px' }}>{fullFileNo}</span>
              </div>
            )}
            <div>DATE: <span style={{ marginLeft: '8px', fontSize: '15px' }}>{formatDate(fd.date)}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
          <div style={{ lineHeight: '26px', minHeight: '26px', marginRight: effectiveQrUrl ? '85px' : '0', wordBreak: 'break-word' }}>
            <span style={{ fontWeight: 'bold', fontSize: '13px', paddingBottom: '1px', marginRight: '8px', display: 'inline' }}>RECEIVED WITH THANKS FROM:</span>
            <span style={{ fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', color: '#1e3a8a', borderBottom: '1px dotted black', padding: '0 8px 1px', display: 'inline', lineHeight: 1.4 }}>{fd.customerName}</span>
          </div>

          <div style={{ lineHeight: '28px', minHeight: '28px', wordBreak: 'break-word', marginTop: '1px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '12px', letterSpacing: '0.04em', paddingBottom: '1px', marginRight: '8px', display: 'inline' }}>THE SUM OF RUPEES:</span>
            <span style={{ fontWeight: 'bold', fontSize: '17px', fontStyle: 'italic', textTransform: 'uppercase', borderBottom: '1px dotted black', padding: '0 8px 1px', display: 'inline', lineHeight: 1.4 }}>
              {amountInWords}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
            {hasValue(fd.model) && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>MODEL:</span>
                <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>{fd.model}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>ON ACCOUNT OF:</span>
              <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>
                {finalPaymentType}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>BY WAY OF:</span>
              <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', minWidth: '120px', textAlign: 'center' }}>{fd.paymentMode}</span>
            </div>
          </div>

          {hasValue(fd.hp) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>H.P. TO:</span>
              <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', minWidth: '150px', textAlign: 'center' }}>{fd.hp}</span>
            </div>
          )}
          {hasValue(fd.mobile) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', marginRight: '6px', whiteSpace: 'nowrap', fontSize: '11px' }}>MOBILE NO:</span>
              <span style={{ borderBottom: '1px dotted black', padding: '0 8px', fontWeight: 'bold', fontSize: '14px', minWidth: '150px', textAlign: 'center' }}>{fd.mobile}</span>
            </div>
          )}
        </div>
      </div>

      {/* Amount + signature */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ border: '2px solid black', padding: '4px 14px', fontSize: '21px', fontWeight: 900, backgroundColor: '#f9fafb', whiteSpace: 'nowrap', letterSpacing: '0.05em', lineHeight: 1 }}>
                ₹ {Number(fd.amount).toLocaleString('en-IN')}/-
              </div>
              {hasValue(fd.dated) && (
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  DATED: <span style={{ marginLeft: '4px' }}>{formatDate(fd.dated)}</span>
                </div>
              )}
            </div>
            {(hasValue(fd.chequeNo) || hasValue(fd.remarks)) && (
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', fontWeight: 600, gap: '2px', marginTop: '4px' }}>
                {hasValue(fd.chequeNo) && (
                  <div style={{ fontStyle: 'italic' }}>Cheque/Ref No: <span style={{ fontWeight: 'bold' }}>{fd.chequeNo}</span></div>
                )}
                {hasValue(fd.remarks) && (
                  <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.2 }}>REMARKS: <span style={{ fontWeight: 'bold' }}>{fd.remarks}</span></div>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', marginBottom: '2px', letterSpacing: '0.04em' }}>
              <span style={{ fontWeight: 500 }}>For</span>{' '}
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11px' }}>VALUE MOTOR AGENCY PVT LTD</span>
            </div>
            <div style={{ height: '12mm', width: '100%' }} aria-hidden="true" />
            <div style={{ fontSize: '11px', borderTop: '2px solid black', display: 'inline-block', padding: '2px 28px 0', fontWeight: 'bold', letterSpacing: '0.04em' }}>
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '4px', paddingTop: '3px', borderTop: '1px solid #9ca3af', position: 'relative', zIndex: 10 }}>
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#1f2937', textTransform: 'uppercase', lineHeight: 1.3, letterSpacing: '0.04em' }}>
          WE BANK WITH STATE BANK OF INDIA | A/C NO: 32744599339 | IFSC: SBIN0021882 | BRANCH: VASANTHNAGAR
        </div>
        <div style={{ fontSize: '8.5px', fontWeight: 900, color: 'black', textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.04em', lineHeight: 1.2 }}>
          <div>CHEQUES SUBJECT TO REALISATION. ANY CANCELLATION SUBJECT TO 10% DEDUCTION.</div>
          <div>PRICES PREVAILING AT THE TIME OF DELIVERY APPLICABLE.</div>
        </div>
      </div>
    </div>
  );
};

// ── ReceiptPrintLayout ────────────────────────────────────────────────────────
/**
 * The hidden div that react-to-print targets.
 * Renders two copies (customer + office) on one A4 page.
 * Attach `componentRef` to this via the `printRef` prop.
 *
 * NOTE: Still used by ArchivePage's "Print" (both copies) button — keep as is.
 */
export const ReceiptPrintLayout = ({ formData, currentFilePrefix, qrDataUrl, qrEnabled, amountInWords, printRef }) => (
  <div
    ref={printRef}
    style={{ width: '210mm', minHeight: '297mm', padding: '5mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12mm', backgroundColor: 'white', fontFamily: 'sans-serif' }}
  >
    <style type="text/css" media="print">
      {tailwindStyles}
      {`@page { size: A4 portrait; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
    </style>

    {/* Customer copy */}
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '1mm', letterSpacing: '0.15em', color: '#6b7280' }}>CUSTOMER COPY</div>
      <div style={{ width: '200mm', height: '120mm', border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
        <ReceiptBody formData={formData} currentFilePrefix={currentFilePrefix} qrDataUrl={qrDataUrl} qrEnabled={qrEnabled} amountInWords={amountInWords} />
      </div>
    </div>

    {/* Office copy */}
    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '15mm' }}>
      <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '1mm', letterSpacing: '0.15em', color: '#6b7280' }}>OFFICE COPY</div>
      <div style={{ width: '185mm', height: '120mm', border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
        <ReceiptBody formData={formData} currentFilePrefix={currentFilePrefix} qrDataUrl={qrDataUrl} qrEnabled={qrEnabled} amountInWords={amountInWords} />
      </div>
    </div>
  </div>
);

// ── CustomerCopyPrintLayout ───────────────────────────────────────────────────
/**
 * Prints ONLY the customer copy, with no copy label.
 * Used by the main Receipt screen (default ReceiptDocument export).
 * Styling of the receipt itself is identical to the customer copy above.
 */
export const CustomerCopyPrintLayout = ({ formData, currentFilePrefix, qrDataUrl, qrEnabled, amountInWords, printRef }) => (
  <div
    ref={printRef}
    style={{ width: '210mm', minHeight: '297mm', padding: '5mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', backgroundColor: 'white', fontFamily: 'sans-serif' }}
  >
    <style type="text/css" media="print">
      {tailwindStyles}
      {`@page { size: A4 portrait; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
    </style>

    {/* Customer copy only — no label */}
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '200mm', height: '120mm', border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
        <ReceiptBody formData={formData} currentFilePrefix={currentFilePrefix} qrDataUrl={qrDataUrl} qrEnabled={qrEnabled} amountInWords={amountInWords} />
      </div>
    </div>
  </div>
);

export const OfficeCopyPrintLayout = ({ formData, currentFilePrefix, qrDataUrl, qrEnabled, amountInWords, printRef }) => (
  <div
    ref={printRef}
    style={{ width: '210mm', minHeight: '297mm', padding: '5mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', backgroundColor: 'white', fontFamily: 'sans-serif' }}
  >
    <style type="text/css" media="print">
      {tailwindStyles}
      {`@page { size: A4 portrait; margin: 0mm !important; } html, body { margin: 0 !important; padding: 0 !important; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
    </style>

    {/* Office copy only — top of sheet */}
    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '15mm' }}>
      <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '1mm', letterSpacing: '0.15em', color: '#6b7280' }}>OFFICE COPY</div>
      <div style={{ width: '185mm', height: '120mm', border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden' }}>
        <ReceiptBody formData={formData} currentFilePrefix={currentFilePrefix} qrDataUrl={qrDataUrl} qrEnabled={qrEnabled} amountInWords={amountInWords} />
      </div>
    </div>
  </div>
);

// ── ReceiptPreview ────────────────────────────────────────────────────────────
/**
 * The live preview panel shown to the right of the form (desktop only).
 * Handles its own ResizeObserver-based scaling via previewPanelRef + previewScale.
 */
export const ReceiptPreview = ({ formData, currentFilePrefix, qrDataUrl, qrEnabled, amountInWords, previewPanelRef, previewScale, isDark, className }) => (
  <div
    ref={previewPanelRef}
    className={className || `hidden lg:flex w-full lg:flex-1 rounded-xl p-4 overflow-hidden items-start justify-center ${isDark ? 'bg-gray-700/50' : 'bg-gray-200'}`}
  >
    <div style={{ width: '100%', height: `${PREVIEW_NATURAL_H * previewScale}px`, position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0,
        left: '50%',
        transform: `translateX(-${(A4_W_PX * previewScale) / 2}px) scale(${previewScale})`,
        transformOrigin: 'top left',
        width: `${A4_W_PX}px`,
      }}>
        <div style={{ backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', padding: `0 ${PAGE_PAD_PX}px`, boxSizing: 'border-box', width: `${A4_W_PX}px` }}>
          <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', padding: '6px 4px 2px', letterSpacing: '0.15em', color: '#6b7280' }}>
            CUSTOMER COPY — PREVIEW
          </div>
          <div style={{ width: `${RECEIPT_W_PX}px`, height: `${RECEIPT_H_PX}px`, border: '3px solid black', borderRadius: '8px', boxSizing: 'border-box', backgroundColor: 'white', color: 'black', position: 'relative', overflow: 'hidden', marginBottom: '6px' }}>
            <ReceiptBody formData={formData} currentFilePrefix={currentFilePrefix} qrDataUrl={qrDataUrl} qrEnabled={qrEnabled} amountInWords={amountInWords} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Default export: convenience wrapper ───────────────────────────────────────
/**
 * Renders both the preview panel AND the hidden print target together.
 * Use this in Receipt.jsx to get both in one import.
 *
 * The hidden print target prints ONLY the customer copy (no office copy, no label).
 */
const ReceiptDocument = ({
  formData,
  currentFilePrefix,
  qrDataUrl,
  qrEnabled,
  amountInWords,
  componentRef,
  previewPanelRef,
  previewScale,
  isDark,
}) => (
  <>
    {/* Live preview (desktop only) */}
    <ReceiptPreview
      formData={formData}
      currentFilePrefix={currentFilePrefix}
      qrDataUrl={qrDataUrl}
      qrEnabled={qrEnabled}
      amountInWords={amountInWords}
      previewPanelRef={previewPanelRef}
      previewScale={previewScale}
      isDark={isDark}
    />

    {/* Hidden print target — customer copy only */}
    <div className="print-only" style={{ position: 'absolute', overflow: 'hidden', height: 0, width: 0, top: '-9999px', left: '-9999px' }}>
      <CustomerCopyPrintLayout
        formData={formData}
        currentFilePrefix={currentFilePrefix}
        qrDataUrl={qrDataUrl}
        qrEnabled={qrEnabled}
        amountInWords={amountInWords}
        printRef={componentRef}
      />
    </div>
  </>
);

export default ReceiptDocument;
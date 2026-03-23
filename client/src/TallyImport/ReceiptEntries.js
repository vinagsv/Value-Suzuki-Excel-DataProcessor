import * as XLSX from 'xlsx';

// ==========================================
// CONFIGURATION (Hardcoded Values)
// ==========================================

const COMPANY_NAME = 'Value Motor Agency Pvt Ltd 2021-22 - (from 1-Apr-22)';
const VOUCHER_TYPE = 'Counter Receipt';
const PARENT_GROUP = 'Sundry Debtors-2025-2026';
const FALLBACK_LEDGER = 'REF GST';

const VALID_TYPES = ['Booking', 'Balance Payment', 'Down Payment'];

const MODE_LEDGERS = {
    'Cash': 'Cash-New',
    'Card': 'Credit Card/Scan QR-Paytm',
    'UPI': 'BHARAT PE A/C',
    'Bank Transfer': 'State Bank of India-Current Account No 339',
    'Cheque': 'State Bank of India-Current Account No 339'
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Escape special characters for XML
function escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString().replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

// Format amount to always have 2 decimal places (e.g. 50000 -> "50000.00")
function formatAmount(raw) {
    const n = parseFloat(raw);
    if (isNaN(n)) return '0.00';
    return n.toFixed(2);
}

// Convert various date formats to Tally's YYYYMMDD
function convertToTallyDate(rawDate) {
    if (!rawDate) return '';

    // Excel serial date number
    if (typeof rawDate === 'number') {
        const dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yyyy}${mm}${dd}`;
    }

    // String date: DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
    if (typeof rawDate === 'string') {
        const datePart = rawDate.substring(0, 10);
        const parts = datePart.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                // DD-MM-YYYY
                return `${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}`;
            } else if (parts[0].length === 4) {
                // YYYY-MM-DD
                return `${parts[0]}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}`;
            }
        }
    }

    return rawDate.toString();
}

// Convert various date formats to a readable DD-MM-YYYY format for narration
function formatDisplayDate(rawDate) {
    if (!rawDate) return '';
    
    // Excel serial date number
    if (typeof rawDate === 'number') {
        const dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${dd}-${mm}-${yyyy}`;
    }
    
    if (typeof rawDate === 'string') {
        const datePart = rawDate.substring(0, 10);
        const parts = datePart.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else if (parts[2].length === 4) {
                return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
            }
        }
    }
    
    return rawDate.toString();
}

// Validate Customer Name — must contain "/NNNN-" (4 digits after a slash)
function isValidCustomerName(name) {
    if (!name) return false;
    return /\/\d{4}-/.test(name);
}

// Generate the Master XML block for a new Ledger
function generateMasterXml(ledgerName) {
    const safeName = escapeXml(ledgerName);
    const safeParent = escapeXml(PARENT_GROUP);
    return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <LEDGER NAME="${safeName}" RESERVEDNAME="" ACTION="Create">
      <OBJECTUPDATEACTION>Create</OBJECTUPDATEACTION>
      <PARENT>${safeParent}</PARENT>
      <CURRENCYNAME>₹</CURRENCYNAME>
      <TAXCLASSIFICATIONNAME>&#4; Not Applicable</TAXCLASSIFICATIONNAME>
      <TAXTYPE>Others</TAXTYPE>
      <ISBILLWISEON>No</ISBILLWISEON>
      <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
      <AFFECTSSTOCK>No</AFFECTSSTOCK>
      <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
      <LEDGERCOUNTRYISDCODE>+91</LEDGERCOUNTRYISDCODE>
      <LANGUAGENAME.LIST>
       <NAME.LIST TYPE="String">
        <NAME>${safeName}</NAME>
       </NAME.LIST>
       <LANGUAGEID> 1033</LANGUAGEID>
      </LANGUAGENAME.LIST>
      <LEDGSTREGDETAILS.LIST>
       <APPLICABLEFROM>20220401</APPLICABLEFROM>
       <GSTREGISTRATIONTYPE>Unregistered/Consumer</GSTREGISTRATIONTYPE>
      </LEDGSTREGDETAILS.LIST>
      <LEDMAILINGDETAILS.LIST>
       <APPLICABLEFROM>20220401</APPLICABLEFROM>
       <MAILINGNAME>${safeName}</MAILINGNAME>
       <STATE>Karnataka</STATE>
       <COUNTRY>India</COUNTRY>
      </LEDMAILINGDETAILS.LIST>
     </LEDGER>
    </TALLYMESSAGE>\n`;
}

// Generate the Transaction XML block for an ACTIVE receipt
function generateActiveTransactionXml(tallyDate, receiptNo, partyLedger, amount, modeLedger, narration, mode, chequeNo, dated) {
    const safeVchType = escapeXml(VOUCHER_TYPE);
    const safeDate = escapeXml(tallyDate);
    const safeReceiptNo = escapeXml(receiptNo.toString());
    const safePartyLedger = escapeXml(partyLedger);
    const safeBankLedger = escapeXml(modeLedger);
    const safeNarration = escapeXml(narration);

    const formattedAmount = formatAmount(amount);
    const creditAmount = formattedAmount;         // Positive  → Party (Credit in Receipt)
    const debitAmount = `-${formattedAmount}`;    // Negative  → Bank/Cash (Debit in Receipt)

    // Construct Bank Allocations if not a Cash transaction
    let bankAllocationsXml = '';
    if (mode !== 'Cash') {
        const instDate = dated ? convertToTallyDate(dated) : safeDate;
        const safeChequeNo = escapeXml(chequeNo || '');
        
        let transType = 'Others';
        let refTag = 'INSTRUMENTNUMBER';
        
        if (mode === 'Cheque') {
            transType = 'Cheque/DD';
        } else if (mode === 'UPI' || mode === 'Bank Transfer' || mode === 'Card') {
            transType = 'e-Fund Transfer';
            if (mode === 'UPI') refTag = 'UNIQUEREFERENCENUMBER';
        }

        bankAllocationsXml = `
       <BANKALLOCATIONS.LIST>
        <DATE>${safeDate}</DATE>
        <INSTRUMENTDATE>${instDate}</INSTRUMENTDATE>
        <TRANSACTIONTYPE>${transType}</TRANSACTIONTYPE>
        <PAYMENTFAVOURING>${safePartyLedger}</PAYMENTFAVOURING>
        <${refTag}>${safeChequeNo}</${refTag}>
        <AMOUNT>${debitAmount}</AMOUNT>
       </BANKALLOCATIONS.LIST>`;
    }

    return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${safeVchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>${safeDate}</DATE>
      <VOUCHERTYPENAME>${safeVchType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${safeReceiptNo}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${safePartyLedger}</PARTYLEDGERNAME>${safeNarration ? `
      <NARRATION>${safeNarration}</NARRATION>` : ''}
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${safePartyLedger}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <AMOUNT>${creditAmount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>${safeBankLedger}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <AMOUNT>${debitAmount}</AMOUNT>${bankAllocationsXml}
      </ALLLEDGERENTRIES.LIST>
     </VOUCHER>
    </TALLYMESSAGE>\n`;
}

// Generate the Transaction XML block for a CANCELLED receipt
function generateCancelledTransactionXml(tallyDate, receiptNo, narration) {
    const safeVchType = escapeXml(VOUCHER_TYPE);
    const safeDate = escapeXml(tallyDate);
    const safeReceiptNo = escapeXml(receiptNo.toString());
    const safeNarration = escapeXml(narration);

    return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${safeVchType}" ACTION="Alter" OBJVIEW="Accounting Voucher View">
      <DATE>${safeDate}</DATE>
      <VOUCHERTYPENAME>${safeVchType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${safeReceiptNo}</VOUCHERNUMBER>
      <ISCANCELLED>Yes</ISCANCELLED>${safeNarration ? `
      <NARRATION>${safeNarration}</NARRATION>` : ''}
     </VOUCHER>
    </TALLYMESSAGE>\n`;
}

// Wrap content in a standard Tally import envelope
function wrapEnvelope(content, reportName) {
    if (!content.trim()) return '';
    return `<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>${reportName}</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${escapeXml(COMPANY_NAME)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
${content}   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}

// ==========================================
// MAIN EXPORT — Client-Side Processing
// ==========================================

export const processReceiptsClientSide = async (fileOrData, uiFromDate, uiToDate) => {
    return new Promise((resolve, reject) => {

        const processRows = (rows) => {
            // Sort rows by Date (ascending), then by Receipt No (ascending)
            rows.sort((a, b) => {
                const dateA = convertToTallyDate(a['Date']) || '';
                const dateB = convertToTallyDate(b['Date']) || '';
                if (dateA !== dateB) {
                    return dateA > dateB ? 1 : -1;
                }
                const recA = parseInt(a['Complete Reciept Number'] || a['Receipt No'] || 0, 10);
                const recB = parseInt(b['Complete Reciept Number'] || b['Receipt No'] || 0, 10);
                return recA - recB;
            });

            let mastersXmlContent = '';
            let transactionsXmlContent = '';
            const createdMasters = new Set();

            let createdCount = 0;
            let cancelledCount = 0;
            let skippedCount = 0;

            const logs = {
                skipped: [],
                cancelled: []
            };

            const activeFromDate = uiFromDate || '';
            const activeToDate = uiToDate || '';

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 2;

                // ── Date ────────────────────────────────────────────
                const rawDate = row['Date'];
                if (!rawDate) {
                    logs.skipped.push(`Row ${rowNumber}: Skipped — missing Date.`);
                    skippedCount++;
                    continue;
                }

                const tallyDate = convertToTallyDate(rawDate);

                // Date range filter
                if ((activeFromDate && tallyDate < activeFromDate) ||
                    (activeToDate  && tallyDate > activeToDate)) {
                    logs.skipped.push(`Row ${rowNumber}: Skipped — Date ${tallyDate} outside filter range.`);
                    skippedCount++;
                    continue;
                }

                // ── Core fields ──────────────────────────────────────
                const receiptNo = row['Receipt No'];
                let ledgerName  = row['File Number-Customer Name'];
                const amount    = row['Amount'];
                const mode      = row['Mode'];
                const type      = row['Type'];
                const status    = String(row['Status']).toUpperCase().trim();
                const chequeNo  = row['Cheque No'];
                const dated     = row['Dated'];
                const remarks   = row['Remarks'];

                // ── Validity check ───────────────────────────────────
                const isInvalidEntry = !isValidCustomerName(ledgerName) || !VALID_TYPES.includes(type);

                // ── Narration ────────────────────────────────────────
                const narrationParts = ['Auto Imported From Excel'];
                if (chequeNo) narrationParts.push(`Cheque No: ${chequeNo}`);
                if (dated)    narrationParts.push(`Dated: ${formatDisplayDate(dated)}`);
                if (remarks)  narrationParts.push(`Remarks: ${remarks}`);
                
                if (!VALID_TYPES.includes(type) && type) {
                    narrationParts.push(`Type: ${type}`);
                }

                if (isInvalidEntry && status === 'ACTIVE') {
                    narrationParts.push(`Original Name: ${ledgerName}`);
                    ledgerName = FALLBACK_LEDGER;
                }

                const narration = narrationParts.join(' | ');

                // ── Process by status ────────────────────────────────
                if (status === 'CANCELLED') {
                    const cancelNarrationParts = ['Auto Imported From Excel'];
                    if (remarks) cancelNarrationParts.push(`Remarks: ${remarks}`);
                    const cancelNarration = cancelNarrationParts.join(' | ');
                    
                    transactionsXmlContent += generateCancelledTransactionXml(tallyDate, receiptNo, cancelNarration);
                    logs.cancelled.push(`Row ${rowNumber}: Cancelled (Receipt No: ${receiptNo}).`);
                    cancelledCount++;

                } else if (status === 'ACTIVE') {
                    const bankLedger = MODE_LEDGERS[mode];
                    if (!bankLedger) {
                        logs.skipped.push(`Row ${rowNumber}: Skipped — unknown Mode '${mode}' for receipt ${receiptNo}.`);
                        skippedCount++;
                        continue;
                    }

                    // Create master ledger only for Booking entries with valid names
                    if (type === 'Booking' && !isInvalidEntry && !createdMasters.has(ledgerName)) {
                        mastersXmlContent += generateMasterXml(ledgerName);
                        createdMasters.add(ledgerName);
                    }

                    // We pass mode, chequeNo, and dated for Bank Allocations
                    transactionsXmlContent += generateActiveTransactionXml(
                        tallyDate, receiptNo, ledgerName, amount, bankLedger, narration, mode, chequeNo, dated
                    );
                    createdCount++;

                } else {
                    logs.skipped.push(`Row ${rowNumber}: Skipped — Status '${status}' is neither ACTIVE nor CANCELLED.`);
                    skippedCount++;
                }
            }

            if (!mastersXmlContent && !transactionsXmlContent) {
                throw new Error('No valid receipts found in the selected date range.');
            }

            const finalMastersXml      = wrapEnvelope(mastersXmlContent, 'All Masters');
            const finalTransactionsXml = wrapEnvelope(transactionsXmlContent, 'Vouchers');

            return {
                createdCount,
                cancelledCount,
                skippedCount,
                mastersCount: createdMasters.size,
                logs,
                mastersXmlData:      finalMastersXml,
                transactionsXmlData: finalTransactionsXml
            };
        };

        if (Array.isArray(fileOrData)) {
            try {
                resolve(processRows(fileOrData));
            } catch (err) {
                reject(err);
            }
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                    resolve(processRows(rows));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(fileOrData);
        }
    });
};
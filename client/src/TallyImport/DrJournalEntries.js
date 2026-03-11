import * as xlsx from 'xlsx';

// Helper: Escape XML special characters to prevent Tally import errors
const escapeXML = (str) => {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

/**
 * Converts Excel data to Tally XML client-side for Debit Journal Entries.
 * In a Debit Journal, the summarized Debit entry comes first, followed by the individual Credit entries from the Excel sheet.
 */
export async function processDrJournalClientSide(file, dateInput, batchSizeStr, debitLedger, validationEnabled = true) {
    if (!file) throw new Error("No file provided.");
    if (!dateInput) throw new Error("Date is required.");
    if (!batchSizeStr || isNaN(parseInt(batchSizeStr, 10)) || parseInt(batchSizeStr, 10) <= 0) {
        throw new Error("Valid Batch Size is required.");
    }
    if (!debitLedger || debitLedger.trim() === '') throw new Error("Debit Ledger Name is required.");

    const batchSize = parseInt(batchSizeStr, 10);
    const tallyDate = dateInput.replace(/-/g, '');

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON array
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
        throw new Error("Excel sheet is empty.");
    }

    // Strict validation to ensure the uploaded file is specifically for Journal (must have LEDGER and AMOUNT columns)
    const firstRowKeys = Object.keys(data[0]).map(k => String(k).trim().toUpperCase());
    const hasLedger = firstRowKeys.includes('LEDGER');
    const hasAmount = firstRowKeys.includes('AMOUNT');

    if (!hasLedger || !hasAmount) {
        throw new Error("Invalid file format. The Excel sheet must contain 'LEDGER' and 'AMOUNT' columns. Please ensure you are not uploading a Bills Daybook file.");
    }

    let xmlString = `<ENVELOPE>\n <HEADER>\n  <TALLYREQUEST>Import Data</TALLYREQUEST>\n </HEADER>\n <BODY>\n  <IMPORTDATA>\n   <REQUESTDESC>\n    <REPORTNAME>Vouchers</REPORTNAME>\n   </REQUESTDESC>\n   <REQUESTDATA>\n`;

    let entryCount = 0;
    let skippedCount = 0;
    let batchCount = 0;
    const batchTotals = []; // Array to store the total debit amount for each batch
    let skippedRowsDetails = []; // Array to store details about skipped rows

    // Pre-process data to filter out invalid rows based on rules
    const validData = [];
    data.forEach((row, index) => {
        // Skip completely empty rows
        if (!row || Object.keys(row).length === 0) return;

        // Ensure the row has actual values, not just empty cells
        const hasValues = Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '');
        if (!hasValues) return;

        // Account for possible case variations if users typed it manually
        const ledgerName = row['LEDGER'] || row['Ledger'] || row['ledger'];
        const rawAmount = row['AMOUNT'] || row['Amount'] || row['amount'];

        // Strict validation for AMOUNT: Safely parse numbers that might contain commas from Excel exports
        let parsedAmount = NaN;
        if (typeof rawAmount === 'string') {
            parsedAmount = parseFloat(rawAmount.replace(/,/g, ''));
        } else if (typeof rawAmount === 'number') {
            parsedAmount = rawAmount;
        }
        
        const isNumber = !isNaN(parsedAmount) && parsedAmount !== null && String(rawAmount).trim() !== '';
        
        // Strict validation for LEDGER: Must begin with "VMA" or "VMH" (if validation is enabled)
        const ledgerUpper = typeof ledgerName === 'string' ? ledgerName.trim().toUpperCase() : '';
        const isValidLedgerPrefix = !validationEnabled || ledgerUpper.startsWith('VMA') || ledgerUpper.startsWith('VMH');

        if (isValidLedgerPrefix && isNumber) {
            validData.push({ ledgerName: ledgerName.trim(), amount: parsedAmount });
        } else {
            // Count as skipped if it had values but failed the VMA/VMH or Number validation
            skippedCount++;
            let reason = `Row ${index + 2}: `; 
            let reasons = [];
            if (!isNumber) reasons.push(`Invalid Amount ("${rawAmount || 'Empty'}")`);
            if (!isValidLedgerPrefix) reasons.push(`Invalid Ledger Prefix ("${ledgerName || 'Empty'}")`);
            reason += reasons.join(', ');
            skippedRowsDetails.push(reason);
        }
    });

    if (validData.length === 0) {
        throw new Error(`No valid records found after applying filters ${validationEnabled ? "(Requires 'VMA' or 'VMH' prefix and valid numeric Amount)" : "(Requires valid numeric Amount)"}.`);
    }

    // Process in Batches
    for (let i = 0; i < validData.length; i += batchSize) {
        // slice() safely handles cases where remaining items are less than batchSize
        const batch = validData.slice(i, i + batchSize);
        let batchTotalAmount = 0;
        batchCount++;

        // 1. Calculate the total debit amount for the batch in advance
        batch.forEach(row => {
            batchTotalAmount += row.amount;
        });
        batchTotalAmount = Math.round(batchTotalAmount * 100) / 100;
        batchTotals.push(batchTotalAmount);

        // Core Tally Message and Voucher Opening
        xmlString += `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
        xmlString += `     <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
        xmlString += `      <DATE>${tallyDate}</DATE>\n`;
        xmlString += `      <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>\n`;
        xmlString += `      <VCHENTRYMODE>As Voucher</VCHENTRYMODE>\n`;
        xmlString += `      <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>\n`;
        xmlString += `      <NARRATION>${escapeXML('Auto imported from excel, Number of Entries: ' + batch.length)}</NARRATION>\n`;

        // 2. Add the summarized Debit Entry FIRST (Simplified to prevent validation bugs in Tally)
        xmlString += `      <ALLLEDGERENTRIES.LIST>\n`;
        xmlString += `       <LEDGERNAME>${escapeXML(debitLedger)}</LEDGERNAME>\n`;
        xmlString += `       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
        xmlString += `       <AMOUNT>-${batchTotalAmount.toFixed(2)}</AMOUNT>\n`;
        xmlString += `      </ALLLEDGERENTRIES.LIST>\n`;

        // 3. Add the individual Credit Entries from the Excel sheet LATER (Simplified to prevent validation bugs in Tally)
        batch.forEach((row) => {
            entryCount++;
            
            xmlString += `      <ALLLEDGERENTRIES.LIST>\n`;
            xmlString += `       <LEDGERNAME>${escapeXML(row.ledgerName)}</LEDGERNAME>\n`;
            xmlString += `       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
            xmlString += `       <AMOUNT>${row.amount.toFixed(2)}</AMOUNT>\n`;
            xmlString += `      </ALLLEDGERENTRIES.LIST>\n`;
        });

        xmlString += `     </VOUCHER>\n`;
        xmlString += `    </TALLYMESSAGE>\n`;
    }

    // Close XML structure
    xmlString += `   </REQUESTDATA>\n  </IMPORTDATA>\n </BODY>\n</ENVELOPE>`;

    return { 
        xmlData: xmlString, 
        createdCount: batchCount, 
        entryCount, 
        skippedCount,
        batchTotals,
        skippedRowsDetails
    };
}
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
 * Converts Excel data to Tally XML client-side for Journal Entries.
 */
export async function processJournalClientSide(file, dateInput, batchSizeStr, creditLedger) {
    if (!file) throw new Error("No file provided.");
    if (!dateInput) throw new Error("Date is required.");
    if (!batchSizeStr || isNaN(parseInt(batchSizeStr, 10)) || parseInt(batchSizeStr, 10) <= 0) {
        throw new Error("Valid Batch Size is required.");
    }
    if (!creditLedger) throw new Error("Credit Ledger Name is required.");

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
    const batchTotals = []; // Array to store the total credit amount for each batch

    // Pre-process data to filter out invalid rows based on new rules
    const validData = [];
    data.forEach(row => {
        // Skip completely empty rows
        if (!row || Object.keys(row).length === 0) return;

        // Ensure the row has actual values, not just empty cells
        const hasValues = Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '');
        if (!hasValues) return;

        // Account for possible case variations if users typed it manually
        const ledgerName = row['LEDGER'] || row['Ledger'] || row['ledger'];
        const rawAmount = row['AMOUNT'] || row['Amount'] || row['amount'];

        // Strict validation for AMOUNT: Check if it's purely a number
        const isNumber = rawAmount !== null && rawAmount !== undefined && String(rawAmount).trim() !== '' && !isNaN(Number(rawAmount));
        
        // Strict validation for LEDGER: Must begin with "VMA" or "VMH"
        const ledgerUpper = typeof ledgerName === 'string' ? ledgerName.trim().toUpperCase() : '';
        const isValidLedgerPrefix = ledgerUpper.startsWith('VMA') || ledgerUpper.startsWith('VMH');

        if (isValidLedgerPrefix && isNumber) {
            validData.push({ ledgerName: ledgerName.trim(), amount: Number(rawAmount) });
        } else {
            // Count as skipped if it had values but failed the VMA/VMH or Number validation
            skippedCount++;
        }
    });

    if (validData.length === 0) {
        throw new Error("No valid records found after applying filters (Requires 'VMA' or 'VMH' prefix and valid numeric Amount).");
    }

    // Process in Batches
    for (let i = 0; i < validData.length; i += batchSize) {
        // slice() safely handles cases where remaining items are less than batchSize
        const batch = validData.slice(i, i + batchSize);
        let batchTotalAmount = 0;
        batchCount++;

        xmlString += `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
        xmlString += `     <VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
        xmlString += `      <DATE>${tallyDate}</DATE>\n`;
        xmlString += `      <VCHSTATUSDATE>${tallyDate}</VCHSTATUSDATE>\n`;
        xmlString += `      <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>\n`;
        xmlString += `      <VCHSTATUSVOUCHERTYPE>Journal</VCHSTATUSVOUCHERTYPE>\n`;
        xmlString += `      <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>\n`;
        xmlString += `      <VCHENTRYMODE>As Voucher</VCHENTRYMODE>\n`;
        xmlString += `      <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>\n`;
        xmlString += `      <NARRATION>Auto imported from excel, Number of Entries:${batch.length}</NARRATION>\n`;

        // Process Debit Entries for this batch
        batch.forEach((row) => {
            batchTotalAmount += row.amount;
            entryCount++;
            
            xmlString += `      <ALLLEDGERENTRIES.LIST>\n`;
            xmlString += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n       </OLDAUDITENTRYIDS.LIST>\n`;
            xmlString += `       <LEDGERNAME>${escapeXML(row.ledgerName)}</LEDGERNAME>\n`;
            xmlString += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
            xmlString += `       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
            xmlString += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
            xmlString += `       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>\n`;
            xmlString += `       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>\n`;
            xmlString += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
            xmlString += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
            xmlString += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
            xmlString += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
            xmlString += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
            xmlString += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
            xmlString += `       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>\n`;
            xmlString += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
            xmlString += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
            xmlString += `       <AMOUNT>-${row.amount.toFixed(2)}</AMOUNT>\n`;
            xmlString += `       <VATEXPAMOUNT>-${row.amount.toFixed(2)}</VATEXPAMOUNT>\n`;
            xmlString += `      </ALLLEDGERENTRIES.LIST>\n`;
        });

        // Process Credit Entry for this batch (Total)
        batchTotalAmount = Math.round(batchTotalAmount * 100) / 100;
        batchTotals.push(batchTotalAmount); // Store this batch's total credit amount

        xmlString += `      <ALLLEDGERENTRIES.LIST>\n`;
        xmlString += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n       </OLDAUDITENTRYIDS.LIST>\n`;
        xmlString += `       <LEDGERNAME>${escapeXML(creditLedger)}</LEDGERNAME>\n`;
        xmlString += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
        xmlString += `       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xmlString += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
        xmlString += `       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>\n`;
        xmlString += `       <ISPARTYLEDGER>No</ISPARTYLEDGER>\n`;
        xmlString += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
        xmlString += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
        xmlString += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
        xmlString += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
        xmlString += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
        xmlString += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
        xmlString += `       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>\n`;
        xmlString += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
        xmlString += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
        xmlString += `       <AMOUNT>${batchTotalAmount.toFixed(2)}</AMOUNT>\n`;
        xmlString += `       <VATEXPAMOUNT>${batchTotalAmount.toFixed(2)}</VATEXPAMOUNT>\n`;
        xmlString += `      </ALLLEDGERENTRIES.LIST>\n`;

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
        batchTotals
    };
}
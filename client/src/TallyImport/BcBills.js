import * as xlsx from 'xlsx';

// ==========================================
// SETTINGS AND CONFIGURATIONS
// ==========================================
const CONFIG = {
    TARGET_SHEET_NAME: "BC AND VMA BILLS",

    // Company Details
    COMPANY: {
        NAME: "Value Motor Agency Pvt Ltd (BACKUP)",
        REMOTE_NAME: "Value Motor Agency Pvt Ltd 2021-22 - (from 1-Apr-22)",
        GUID: "1d1e0390-a42e-4704-899b-839c3939bb43",
        GSTIN: "29AACCV2521J1ZA",
        STATE: "Karnataka",
        COUNTRY: "India"
    },

    // Voucher Configuration
    VOUCHER: {
        TYPE: "Work Shop Sale Vas"
    },

    // Bill Format Configuration
    BILL_FORMAT: {
        // Strictly matches "1/BC/" followed by exactly 8 digits
        REGEX: /^1\/BC\/(\d{8})$/i
    },

    // Excel Column Mappings
    EXCEL_MAPPING: {
        DATE: 'DATE',
        BILL_NUM: 'BC BILLS NO',
        MODE_OF_PAYMENT: 'MODE OF PAYMENT',
        TAXABLE_AMOUNT: 'TAX AMT',
        LABOUR_CHARGES: 'LABOUR CHRGS',
        TOTAL: 'TOTAL',
        NARRATION: 'NARRATION'
    },

    // Ledger Names Configuration
    LEDGERS: {
        ALLOWED_PAYMENT_MODES: [
            "Bharat Pe",
            "Cash-New",
            "REF GST",
            "Credit Card/Scan QR-Paytm",
            "State Bank of India-Current Account No 339"
        ],
        SALES: "Sales @ 18% GST Local",
        CGST: "CGST OUTPUT",
        SGST: "SGST OUTPUT",
        ROUND_OFF: "Round Off",
        LABOUR: "Labour Charges Received"
    },

    // Tax and HSN Information
    TAX_INFO: {
        SALES_HSN: "85319000",
        LABOUR_HSN: "998729",
        LABOUR_DESC: "Two Wheeler Servicing"
    }
};

// ==========================================
// HELPERS
// ==========================================

// Helper: Check if a value is strictly a valid number
const isInvalidNumber = (val) => {
    if (val === undefined || val === null) return true;
    const strVal = val.toString().trim();
    if (strVal === '') return true;
    if (isNaN(Number(strVal))) return true;
    return false;
};

// Helper: Validate Ledger
const getValidLedgerName = (mode) => {
    const trimmedMode = (mode || '').toString().trim();
    const match = CONFIG.LEDGERS.ALLOWED_PAYMENT_MODES.find(l => l.toLowerCase() === trimmedMode.toLowerCase());
    return match || null;
};

/**
 * Converts Excel data to Tally XML client-side for BC Bills.
 */
export async function processBCFileClientSide(file, fromDateStr = null, toDateStr = null) {
    if (!file) {
        throw new Error("No file provided for processing.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    
    if (!workbook.SheetNames.includes(CONFIG.TARGET_SHEET_NAME)) {
        throw new Error(`Sheet named "${CONFIG.TARGET_SHEET_NAME}" not found in the uploaded Excel file.`);
    }
    
    const sheet = workbook.Sheets[CONFIG.TARGET_SHEET_NAME];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
        throw new Error("Excel sheet is empty.");
    }

    const headers = data[0].map(h => (h || '').toString().trim().toUpperCase());
    const colIdx = {
        date: headers.indexOf(CONFIG.EXCEL_MAPPING.DATE.toUpperCase()),
        billNum: headers.indexOf(CONFIG.EXCEL_MAPPING.BILL_NUM.toUpperCase()),
        mode: headers.indexOf(CONFIG.EXCEL_MAPPING.MODE_OF_PAYMENT.toUpperCase()),
        taxable: headers.indexOf(CONFIG.EXCEL_MAPPING.TAXABLE_AMOUNT.toUpperCase()),
        labour: headers.indexOf(CONFIG.EXCEL_MAPPING.LABOUR_CHARGES.toUpperCase()),
        total: headers.indexOf(CONFIG.EXCEL_MAPPING.TOTAL.toUpperCase()),
        narration: headers.indexOf(CONFIG.EXCEL_MAPPING.NARRATION.toUpperCase())
    };

    if (colIdx.date === -1 || colIdx.billNum === -1) {
        throw new Error(`Could not find required '${CONFIG.EXCEL_MAPPING.DATE}' or '${CONFIG.EXCEL_MAPPING.BILL_NUM}' columns in the header.`);
    }

    let xml = `<ENVELOPE>\n`;
    xml += ` <HEADER>\n`;
    xml += `  <TALLYREQUEST>Import Data</TALLYREQUEST>\n`;
    xml += ` </HEADER>\n`;
    xml += ` <BODY>\n`;
    xml += `  <IMPORTDATA>\n`;
    xml += `   <REQUESTDESC>\n`;
    xml += `    <REPORTNAME>Vouchers</REPORTNAME>\n`;
    xml += `    <STATICVARIABLES>\n`;
    xml += `     <SVCURRENTCOMPANY>${CONFIG.COMPANY.NAME}</SVCURRENTCOMPANY>\n`;
    xml += `    </STATICVARIABLES>\n`;
    xml += `   </REQUESTDESC>\n`;
    xml += `   <REQUESTDATA>\n`;

    let createdCount = 0;
    let cancelledCount = 0;
    let skippedCount = 0;

    let lastValidSeq = null;

    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        if (!row || row.length === 0 || row[colIdx.date] === undefined) {
            skippedCount++;
            continue;
        }

        const rawBillNumber = (row[colIdx.billNum] || '').toString().trim();
        const dateRaw = row[colIdx.date];

        if (!rawBillNumber) {
            skippedCount++;
            continue;
        }

        const billMatch = rawBillNumber.match(CONFIG.BILL_FORMAT.REGEX);
        if (!billMatch) {
            skippedCount++;
            continue;
        }

        let dateFormatted = '';
        if (typeof dateRaw === 'number') {
             const parsedDate = xlsx.SSF.parse_date_code(dateRaw);
             const yyyy = parsedDate.y;
             const mm = String(parsedDate.m).padStart(2, '0');
             const dd = String(parsedDate.d).padStart(2, '0');
             dateFormatted = `${yyyy}${mm}${dd}`;
        } else if (typeof dateRaw === 'string') {
             let dStr = dateRaw.trim();
             if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(dStr)) {
                 dateFormatted = dStr.replace(/[-/]/g, '');
             } else if (/\d{2}[-/]\d{2}[-/]\d{4}/.test(dStr)) {
                 const parts = dStr.split(/[-/]/);
                 dateFormatted = `${parts[2]}${parts[1]}${parts[0]}`;
             } else {
                 const temp = new Date(dStr);
                 if (!isNaN(temp)) {
                     const yyyy = temp.getUTCFullYear();
                     const mm = String(temp.getUTCMonth() + 1).padStart(2, '0');
                     const dd = String(temp.getUTCDate()).padStart(2, '0');
                     dateFormatted = `${yyyy}${mm}${dd}`;
                 }
             }
        } else if (dateRaw instanceof Date) {
            const yyyy = dateRaw.getUTCFullYear();
            const mm = String(dateRaw.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(dateRaw.getUTCDate()).padStart(2, '0');
            dateFormatted = `${yyyy}${mm}${dd}`;
        }

        // Apply Date Filtering
        if (fromDateStr && dateFormatted < fromDateStr) {
            skippedCount++;
            continue;
        }
        if (toDateStr && dateFormatted > toDateStr) {
            skippedCount++;
            continue;
        }

        const currentSeq = parseInt(billMatch[1], 10);
        if (lastValidSeq !== null && currentSeq > lastValidSeq + 1) {
            for (let missingSeq = lastValidSeq + 1; missingSeq < currentSeq; missingSeq++) {
                const missingBillNumber = `1/BC/${String(missingSeq).padStart(8, '0')}`;
                xml += buildCancelledXML(dateFormatted, missingBillNumber, "Auto Imported from Excel - Missing Number Cancelled");
                cancelledCount++;
            }
        }
        lastValidSeq = currentSeq;

        const rawPaymentMode = (colIdx.mode !== -1) ? row[colIdx.mode] : '';
        const rawSales = (colIdx.taxable !== -1) ? row[colIdx.taxable] : '';
        const rawLabour = (colIdx.labour !== -1) ? row[colIdx.labour] : '';
        const rawTotal = (colIdx.total !== -1) ? row[colIdx.total] : '';
        const rawNarration = (colIdx.narration !== -1) ? (row[colIdx.narration] || '').toString().trim() : '';

        const finalNarration = rawNarration ? `Auto Imported from Excel ${rawNarration}` : `Auto Imported from Excel`;
        
        const validLedger = getValidLedgerName(rawPaymentMode);
        const isSalesInvalid = isInvalidNumber(rawSales);
        const isTotalInvalid = isInvalidNumber(rawTotal);
        
        const targetTotal = parseFloat(rawTotal) || 0;
        const salesAmount = parseFloat(rawSales) || 0;
        const labourAmount = isInvalidNumber(rawLabour) ? 0 : parseFloat(rawLabour);
        const areBothAmountsZero = salesAmount === 0 && labourAmount === 0;

        if (!validLedger || isSalesInvalid || isTotalInvalid || targetTotal <= 0 || areBothAmountsZero) {
            xml += buildCancelledXML(dateFormatted, rawBillNumber, finalNarration);
            cancelledCount++;
        } else {
            xml += buildNormalXML(dateFormatted, rawBillNumber, validLedger, salesAmount, labourAmount, targetTotal, finalNarration);
            createdCount++;
        }
    }

    xml += `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `     <COMPANY>\n`;
    xml += `      <REMOTECMPINFO.LIST MERGE="Yes">\n`;
    xml += `       <NAME>${CONFIG.COMPANY.GUID}</NAME>\n`;
    xml += `       <REMOTECMPNAME>${CONFIG.COMPANY.REMOTE_NAME}</REMOTECMPNAME>\n`;
    xml += `       <REMOTECMPSTATE>${CONFIG.COMPANY.STATE}</REMOTECMPSTATE>\n`;
    xml += `      </REMOTECMPINFO.LIST>\n`;
    xml += `     </COMPANY>\n`;
    xml += `    </TALLYMESSAGE>\n`;
    xml += `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `     <COMPANY>\n`;
    xml += `      <REMOTECMPINFO.LIST MERGE="Yes">\n`;
    xml += `       <NAME>${CONFIG.COMPANY.GUID}</NAME>\n`;
    xml += `       <REMOTECMPNAME>${CONFIG.COMPANY.REMOTE_NAME}</REMOTECMPNAME>\n`;
    xml += `       <REMOTECMPSTATE>${CONFIG.COMPANY.STATE}</REMOTECMPSTATE>\n`;
    xml += `      </REMOTECMPINFO.LIST>\n`;
    xml += `     </COMPANY>\n`;
    xml += `    </TALLYMESSAGE>\n`;

    xml += `   </REQUESTDATA>\n`;
    xml += `  </IMPORTDATA>\n`;
    xml += ` </BODY>\n`;
    xml += `</ENVELOPE>\n`;

    return { xmlData: xml, createdCount, cancelledCount, skippedCount };
}

// ==========================================
// XML GENERATOR HELPERS
// ==========================================

function buildCancelledXML(dateFormatted, billNumber, narration) {
    const uniqueGuid = window.crypto.randomUUID();
    let xml = `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `     <VOUCHER REMOTEID="${uniqueGuid}" VCHTYPE="${CONFIG.VOUCHER.TYPE}" ACTION="Create" OBJVIEW="Invoice Voucher View">\n`;
    xml += `      <DATE>${dateFormatted}</DATE>\n`;
    xml += `      <VCHSTATUSDATE>${dateFormatted}</VCHSTATUSDATE>\n`;
    xml += `      <GUID>${uniqueGuid}</GUID>\n`;
    xml += `      <NARRATION>${narration}</NARRATION>\n`;
    xml += `      <ENTEREDBY>accounts</ENTEREDBY>\n`;
    xml += `      <OBJECTUPDATEACTION>Create</OBJECTUPDATEACTION>\n`;
    xml += `      <VOUCHERTYPENAME>${CONFIG.VOUCHER.TYPE}</VOUCHERTYPENAME>\n`;
    xml += `      <GSTREGISTRATION TAXTYPE="GST" TAXREGISTRATION="${CONFIG.COMPANY.GSTIN}">${CONFIG.COMPANY.STATE} Registration</GSTREGISTRATION>\n`;
    xml += `      <VOUCHERNUMBER>${billNumber}</VOUCHERNUMBER>\n`;
    xml += `      <NUMBERINGSTYLE>Automatic (Manual Override)</NUMBERINGSTYLE>\n`;
    xml += `      <CSTFORMISSUETYPE>&#4; Not Applicable</CSTFORMISSUETYPE>\n`;
    xml += `      <CSTFORMRECVTYPE>&#4; Not Applicable</CSTFORMRECVTYPE>\n`;
    xml += `      <VCHSTATUSTAXADJUSTMENT>Default</VCHSTATUSTAXADJUSTMENT>\n`;
    xml += `      <VCHSTATUSVOUCHERTYPE>${CONFIG.VOUCHER.TYPE}</VCHSTATUSVOUCHERTYPE>\n`;
    xml += `      <VCHSTATUSTAXUNIT>${CONFIG.COMPANY.STATE} Registration</VCHSTATUSTAXUNIT>\n`;
    xml += `      <VCHGSTCLASS>&#4; Not Applicable</VCHGSTCLASS>\n`;
    xml += `      <DIFFACTUALQTY>No</DIFFACTUALQTY>\n`;
    xml += `      <ISMSTFROMSYNC>No</ISMSTFROMSYNC>\n`;
    xml += `      <ISDELETED>No</ISDELETED>\n`;
    xml += `      <ISSECURITYONWHENENTERED>No</ISSECURITYONWHENENTERED>\n`;
    xml += `      <ASORIGINAL>No</ASORIGINAL>\n`;
    xml += `      <AUDITED>No</AUDITED>\n`;
    xml += `      <ISCOMMONPARTY>No</ISCOMMONPARTY>\n`;
    xml += `      <FORJOBCOSTING>No</FORJOBCOSTING>\n`;
    xml += `      <ISOPTIONAL>No</ISOPTIONAL>\n`;
    xml += `      <EFFECTIVEDATE>${dateFormatted}</EFFECTIVEDATE>\n`;
    xml += `      <USEFOREXCISE>No</USEFOREXCISE>\n`;
    xml += `      <ISFORJOBWORKIN>No</ISFORJOBWORKIN>\n`;
    xml += `      <ALLOWCONSUMPTION>No</ALLOWCONSUMPTION>\n`;
    xml += `      <USEFORINTEREST>No</USEFORINTEREST>\n`;
    xml += `      <USEFORGAINLOSS>No</USEFORGAINLOSS>\n`;
    xml += `      <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>\n`;
    xml += `      <USEFORCOMPOUND>No</USEFORCOMPOUND>\n`;
    xml += `      <USEFORSERVICETAX>No</USEFORSERVICETAX>\n`;
    xml += `      <ISREVERSECHARGEAPPLICABLE>No</ISREVERSECHARGEAPPLICABLE>\n`;
    xml += `      <ISSYSTEM>No</ISSYSTEM>\n`;
    xml += `      <ISFETCHEDONLY>No</ISFETCHEDONLY>\n`;
    xml += `      <ISGSTOVERRIDDEN>No</ISGSTOVERRIDDEN>\n`;
    xml += `      <ISCANCELLED>Yes</ISCANCELLED>\n`;
    xml += `      <ISONHOLD>No</ISONHOLD>\n`;
    xml += `      <ISSUMMARY>No</ISSUMMARY>\n`;
    xml += `      <ISECOMMERCESUPPLY>No</ISECOMMERCESUPPLY>\n`;
    xml += `      <ISBOENOTAPPLICABLE>No</ISBOENOTAPPLICABLE>\n`;
    xml += `      <ISGSTSECSEVENAPPLICABLE>No</ISGSTSECSEVENAPPLICABLE>\n`;
    xml += `      <IGNOREEINVVALIDATION>No</IGNOREEINVVALIDATION>\n`;
    xml += `      <CMPGSTISOTHTERRITORYASSESSEE>No</CMPGSTISOTHTERRITORYASSESSEE>\n`;
    xml += `      <PARTYGSTISOTHTERRITORYASSESSEE>No</PARTYGSTISOTHTERRITORYASSESSEE>\n`;
    xml += `      <IRNJSONEXPORTED>No</IRNJSONEXPORTED>\n`;
    xml += `      <IRNCANCELLED>No</IRNCANCELLED>\n`;
    xml += `      <IGNOREGSTCONFLICTINMIG>No</IGNOREGSTCONFLICTINMIG>\n`;
    xml += `      <ISOPBALTRANSACTION>No</ISOPBALTRANSACTION>\n`;
    xml += `      <IGNOREGSTFORMATVALIDATION>No</IGNOREGSTFORMATVALIDATION>\n`;
    xml += `      <ISELIGIBLEFORITC>No</ISELIGIBLEFORITC>\n`;
    xml += `      <IGNOREGSTOPTIONALUNCERTAIN>No</IGNOREGSTOPTIONALUNCERTAIN>\n`;
    xml += `      <UPDATESUMMARYVALUES>No</UPDATESUMMARYVALUES>\n`;
    xml += `      <ISEWAYBILLAPPLICABLE>No</ISEWAYBILLAPPLICABLE>\n`;
    xml += `      <ISDELETEDRETAINED>No</ISDELETEDRETAINED>\n`;
    xml += `      <ISNULL>No</ISNULL>\n`;
    xml += `      <ISEXCISEVOUCHER>No</ISEXCISEVOUCHER>\n`;
    xml += `      <EXCISETAXOVERRIDE>No</EXCISETAXOVERRIDE>\n`;
    xml += `      <USEFORTAXUNITTRANSFER>No</USEFORTAXUNITTRANSFER>\n`;
    xml += `      <ISEXER1NOPOVERWRITE>No</ISEXER1NOPOVERWRITE>\n`;
    xml += `      <ISEXF2NOPOVERWRITE>No</ISEXF2NOPOVERWRITE>\n`;
    xml += `      <ISEXER3NOPOVERWRITE>No</ISEXER3NOPOVERWRITE>\n`;
    xml += `      <IGNOREPOSVALIDATION>No</IGNOREPOSVALIDATION>\n`;
    xml += `      <EXCISEOPENING>No</EXCISEOPENING>\n`;
    xml += `      <USEFORFINALPRODUCTION>No</USEFORFINALPRODUCTION>\n`;
    xml += `      <ISTDSOVERRIDDEN>No</ISTDSOVERRIDDEN>\n`;
    xml += `      <ISTCSOVERRIDDEN>No</ISTCSOVERRIDDEN>\n`;
    xml += `      <ISTDSTCSCASHVCH>No</ISTDSTCSCASHVCH>\n`;
    xml += `      <INCLUDEADVPYMTVCH>No</INCLUDEADVPYMTVCH>\n`;
    xml += `      <ISSUBWORKSCONTRACT>No</ISSUBWORKSCONTRACT>\n`;
    xml += `      <ISVATOVERRIDDEN>No</ISVATOVERRIDDEN>\n`;
    xml += `      <IGNOREORIGVCHDATE>No</IGNOREORIGVCHDATE>\n`;
    xml += `      <ISVATPAIDATCUSTOMS>No</ISVATPAIDATCUSTOMS>\n`;
    xml += `      <ISDECLAREDTOCUSTOMS>No</ISDECLAREDTOCUSTOMS>\n`;
    xml += `      <VATADVANCEPAYMENT>No</VATADVANCEPAYMENT>\n`;
    xml += `      <VATADVPAY>No</VATADVPAY>\n`;
    xml += `      <ISCSTDELCAREDGOODSSALES>No</ISCSTDELCAREDGOODSSALES>\n`;
    xml += `      <ISVATRESTAXINV>No</ISVATRESTAXINV>\n`;
    xml += `      <ISSERVICETAXOVERRIDDEN>No</ISSERVICETAXOVERRIDDEN>\n`;
    xml += `      <ISISDVOUCHER>No</ISISDVOUCHER>\n`;
    xml += `      <ISEXCISEOVERRIDDEN>No</ISEXCISEOVERRIDDEN>\n`;
    xml += `      <ISEXCISESUPPLYVCH>No</ISEXCISESUPPLYVCH>\n`;
    xml += `      <GSTNOTEXPORTED>No</GSTNOTEXPORTED>\n`;
    xml += `      <IGNOREGSTINVALIDATION>No</IGNOREGSTINVALIDATION>\n`;
    xml += `      <ISGSTREFUND>No</ISGSTREFUND>\n`;
    xml += `      <OVRDNEWAYBILLAPPLICABILITY>No</OVRDNEWAYBILLAPPLICABILITY>\n`;
    xml += `      <ISVATPRINCIPALACCOUNT>No</ISVATPRINCIPALACCOUNT>\n`;
    xml += `      <VCHSTATUSISVCHNUMUSED>No</VCHSTATUSISVCHNUMUSED>\n`;
    xml += `      <VCHGSTSTATUSISINCLUDED>No</VCHGSTSTATUSISINCLUDED>\n`;
    xml += `      <VCHGSTSTATUSISUNCERTAIN>No</VCHGSTSTATUSISUNCERTAIN>\n`;
    xml += `      <VCHGSTSTATUSISEXCLUDED>No</VCHGSTSTATUSISEXCLUDED>\n`;
    xml += `      <VCHGSTSTATUSISAPPLICABLE>No</VCHGSTSTATUSISAPPLICABLE>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BRECONCILED>No</VCHGSTSTATUSISGSTR2BRECONCILED>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BONLYINPORTAL>No</VCHGSTSTATUSISGSTR2BONLYINPORTAL>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BONLYINBOOKS>No</VCHGSTSTATUSISGSTR2BONLYINBOOKS>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BMISMATCH>No</VCHGSTSTATUSISGSTR2BMISMATCH>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BINDIFFPERIOD>No</VCHGSTSTATUSISGSTR2BINDIFFPERIOD>\n`;
    xml += `      <VCHGSTSTATUSISRETEFFDATEOVERRDN>No</VCHGSTSTATUSISRETEFFDATEOVERRDN>\n`;
    xml += `      <VCHGSTSTATUSISOVERRDN>No</VCHGSTSTATUSISOVERRDN>\n`;
    xml += `      <VCHGSTSTATUSISSTATINDIFFDATE>No</VCHGSTSTATUSISSTATINDIFFDATE>\n`;
    xml += `      <VCHGSTSTATUSISRETINDIFFDATE>No</VCHGSTSTATUSISRETINDIFFDATE>\n`;
    xml += `      <VCHGSTSTATUSMAINSECTIONEXCLUDED>No</VCHGSTSTATUSMAINSECTIONEXCLUDED>\n`;
    xml += `      <VCHGSTSTATUSISBRANCHTRANSFEROUT>No</VCHGSTSTATUSISBRANCHTRANSFEROUT>\n`;
    xml += `      <VCHGSTSTATUSISSYSTEMSUMMARY>No</VCHGSTSTATUSISSYSTEMSUMMARY>\n`;
    xml += `      <VCHSTATUSISUNREGISTEREDRCM>No</VCHSTATUSISUNREGISTEREDRCM>\n`;
    xml += `      <VCHSTATUSISOPTIONAL>No</VCHSTATUSISOPTIONAL>\n`;
    xml += `      <VCHSTATUSISCANCELLED>Yes</VCHSTATUSISCANCELLED>\n`;
    xml += `      <VCHSTATUSISDELETED>No</VCHSTATUSISDELETED>\n`;
    xml += `      <VCHSTATUSISOPENINGBALANCE>No</VCHSTATUSISOPENINGBALANCE>\n`;
    xml += `      <VCHSTATUSISFETCHEDONLY>No</VCHSTATUSISFETCHEDONLY>\n`;
    xml += `      <VCHGSTSTATUSISOPTIONALUNCERTAIN>No</VCHGSTSTATUSISOPTIONALUNCERTAIN>\n`;
    xml += `      <VCHSTATUSISREACCEPTFORHSNDONE>No</VCHSTATUSISREACCEPTFORHSNDONE>\n`;
    xml += `      <VCHSTATUSISREACCEPHSNSIXONEDONE>No</VCHSTATUSISREACCEPHSNSIXONEDONE>\n`;
    xml += `      <PAYMENTLINKHASMULTIREF>No</PAYMENTLINKHASMULTIREF>\n`;
    xml += `      <ISSHIPPINGWITHINSTATE>No</ISSHIPPINGWITHINSTATE>\n`;
    xml += `      <ISOVERSEASTOURISTTRANS>No</ISOVERSEASTOURISTTRANS>\n`;
    xml += `      <ISDESIGNATEDZONEPARTY>No</ISDESIGNATEDZONEPARTY>\n`;
    xml += `      <HASCASHFLOW>No</HASCASHFLOW>\n`;
    xml += `      <ISPOSTDATED>No</ISPOSTDATED>\n`;
    xml += `      <USETRACKINGNUMBER>No</USETRACKINGNUMBER>\n`;
    xml += `      <ISINVOICE>Yes</ISINVOICE>\n`;
    xml += `      <MFGJOURNAL>No</MFGJOURNAL>\n`;
    xml += `      <HASDISCOUNTS>No</HASDISCOUNTS>\n`;
    xml += `      <ASPAYSLIP>No</ASPAYSLIP>\n`;
    xml += `      <ISCOSTCENTRE>No</ISCOSTCENTRE>\n`;
    xml += `      <ISSTXNONREALIZEDVCH>No</ISSTXNONREALIZEDVCH>\n`;
    xml += `      <ISEXCISEMANUFACTURERON>No</ISEXCISEMANUFACTURERON>\n`;
    xml += `      <ISBLANKCHEQUE>No</ISBLANKCHEQUE>\n`;
    xml += `      <ISVOID>No</ISVOID>\n`;
    xml += `      <ORDERLINESTATUS>No</ORDERLINESTATUS>\n`;
    xml += `      <VATISAGNSTCANCSALES>No</VATISAGNSTCANCSALES>\n`;
    xml += `      <VATISPURCEXEMPTED>No</VATISPURCEXEMPTED>\n`;
    xml += `      <ISVATRESTAXINVOICE>No</ISVATRESTAXINVOICE>\n`;
    xml += `      <VATISASSESABLECALCVCH>No</VATISASSESABLECALCVCH>\n`;
    xml += `      <ISVATDUTYPAID>No</ISVATDUTYPAID>\n`;
    xml += `      <ISDELIVERYSAMEASCONSIGNEE>No</ISDELIVERYSAMEASCONSIGNEE>\n`;
    xml += `      <ISDISPATCHSAMEASCONSIGNOR>No</ISDISPATCHSAMEASCONSIGNOR>\n`;
    xml += `      <ISDELETEDVCHRETAINED>No</ISDELETEDVCHRETAINED>\n`;
    xml += `      <VCHONLYADDLINFOUPDATED>No</VCHONLYADDLINFOUPDATED>\n`;
    xml += `      <CHANGEVCHMODE>No</CHANGEVCHMODE>\n`;
    xml += `      <RESETIRNQRCODE>No</RESETIRNQRCODE>\n`;
    xml += `      <VOUCHERNUMBERSERIES>Default</VOUCHERNUMBERSERIES>\n`;
    xml += `      <EWAYBILLDETAILS.LIST>      </EWAYBILLDETAILS.LIST>\n`;
    xml += `      <EXCLUDEDTAXATIONS.LIST>      </EXCLUDEDTAXATIONS.LIST>\n`;
    xml += `      <OLDAUDITENTRIES.LIST>      </OLDAUDITENTRIES.LIST>\n`;
    xml += `      <ACCOUNTAUDITENTRIES.LIST>      </ACCOUNTAUDITENTRIES.LIST>\n`;
    xml += `      <AUDITENTRIES.LIST>      </AUDITENTRIES.LIST>\n`;
    xml += `      <DUTYHEADDETAILS.LIST>      </DUTYHEADDETAILS.LIST>\n`;
    xml += `      <GSTADVADJDETAILS.LIST>      </GSTADVADJDETAILS.LIST>\n`;
    xml += `      <ALLINVENTORYENTRIES.LIST>      </ALLINVENTORYENTRIES.LIST>\n`;
    xml += `      <CONTRITRANS.LIST>      </CONTRITRANS.LIST>\n`;
    xml += `      <EWAYBILLERRORLIST.LIST>      </EWAYBILLERRORLIST.LIST>\n`;
    xml += `      <IRNERRORLIST.LIST>      </IRNERRORLIST.LIST>\n`;
    xml += `      <HARYANAVAT.LIST>      </HARYANAVAT.LIST>\n`;
    xml += `      <SUPPLEMENTARYDUTYHEADDETAILS.LIST>      </SUPPLEMENTARYDUTYHEADDETAILS.LIST>\n`;
    xml += `      <INVOICEDELNOTES.LIST>      </INVOICEDELNOTES.LIST>\n`;
    xml += `      <INVOICEORDERLIST.LIST>      </INVOICEORDERLIST.LIST>\n`;
    xml += `      <INVOICEINDENTLIST.LIST>      </INVOICEINDENTLIST.LIST>\n`;
    xml += `      <ATTENDANCEENTRIES.LIST>      </ATTENDANCEENTRIES.LIST>\n`;
    xml += `      <ORIGINVOICEDETAILS.LIST>      </ORIGINVOICEDETAILS.LIST>\n`;
    xml += `      <INVOICEEXPORTLIST.LIST>      </INVOICEEXPORTLIST.LIST>\n`;
    xml += `      <LEDGERENTRIES.LIST>      </LEDGERENTRIES.LIST>\n`;
    xml += `      <GST.LIST>      </GST.LIST>\n`;
    xml += `      <STKJRNLADDLCOSTDETAILS.LIST>      </STKJRNLADDLCOSTDETAILS.LIST>\n`;
    xml += `      <PAYROLLMODEOFPAYMENT.LIST>      </PAYROLLMODEOFPAYMENT.LIST>\n`;
    xml += `      <ATTDRECORDS.LIST>      </ATTDRECORDS.LIST>\n`;
    xml += `      <GSTEWAYCONSIGNORADDRESS.LIST>      </GSTEWAYCONSIGNORADDRESS.LIST>\n`;
    xml += `      <GSTEWAYCONSIGNEEADDRESS.LIST>      </GSTEWAYCONSIGNEEADDRESS.LIST>\n`;
    xml += `      <TEMPGSTRATEDETAILS.LIST>      </TEMPGSTRATEDETAILS.LIST>\n`;
    xml += `      <TEMPGSTADVADJUSTED.LIST>      </TEMPGSTADVADJUSTED.LIST>\n`;
    xml += `      <GSTBUYERADDRESS.LIST>      </GSTBUYERADDRESS.LIST>\n`;
    xml += `      <GSTCONSIGNEEADDRESS.LIST>      </GSTCONSIGNEEADDRESS.LIST>\n`;
    xml += `     </VOUCHER>\n`;
    xml += `    </TALLYMESSAGE>\n`;
    return xml;
}

function buildNormalXML(dateFormatted, billNumber, paymentMode, salesAmount, labourAmount, targetTotal, narration) {
    const uniqueGuid = window.crypto.randomUUID();
    let totalCgst = 0;
    let totalSgst = 0;

    if (salesAmount > 0) {
        totalCgst += Math.round((salesAmount * 0.09) * 100) / 100;
        totalSgst += Math.round((salesAmount * 0.09) * 100) / 100;
    }
    if (labourAmount > 0) {
        totalCgst += Math.round((labourAmount * 0.09) * 100) / 100;
        totalSgst += Math.round((labourAmount * 0.09) * 100) / 100;
    }

    const calculatedTotal = salesAmount + labourAmount + totalCgst + totalSgst;
    const roundOff = Math.round((targetTotal - calculatedTotal) * 100) / 100;
    
    const roundOffIsDeemedPositive = 'No';
    const roundOffAmountStr = roundOff.toFixed(2); 

    let xml = `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `     <VOUCHER REMOTEID="${uniqueGuid}" VCHTYPE="${CONFIG.VOUCHER.TYPE}" ACTION="Create" OBJVIEW="Invoice Voucher View">\n`;
    xml += `      <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
    xml += `       <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
    xml += `      </OLDAUDITENTRYIDS.LIST>\n`;
    xml += `      <DATE>${dateFormatted}</DATE>\n`;
    xml += `      <VCHSTATUSDATE>${dateFormatted}</VCHSTATUSDATE>\n`;
    xml += `      <GUID>${uniqueGuid}</GUID>\n`;
    xml += `      <GSTREGISTRATIONTYPE>Unregistered/Consumer</GSTREGISTRATIONTYPE>\n`;
    xml += `      <VATDEALERTYPE>Unregistered</VATDEALERTYPE>\n`;
    xml += `      <STATENAME>${CONFIG.COMPANY.STATE}</STATENAME>\n`;
    xml += `      <ENTEREDBY>accounts</ENTEREDBY>\n`;
    xml += `      <NARRATION>${narration}</NARRATION>\n`;
    xml += `      <OBJECTUPDATEACTION>Create</OBJECTUPDATEACTION>\n`;
    xml += `      <COUNTRYOFRESIDENCE>${CONFIG.COMPANY.COUNTRY}</COUNTRYOFRESIDENCE>\n`;
    xml += `      <PLACEOFSUPPLY>${CONFIG.COMPANY.STATE}</PLACEOFSUPPLY>\n`;
    xml += `      <VOUCHERTYPENAME>${CONFIG.VOUCHER.TYPE}</VOUCHERTYPENAME>\n`;
    xml += `      <CLASSNAME>Default Voucher Class</CLASSNAME>\n`;
    xml += `      <PARTYNAME>${paymentMode}</PARTYNAME>\n`;
    xml += `      <GSTREGISTRATION TAXTYPE="GST" TAXREGISTRATION="${CONFIG.COMPANY.GSTIN}">${CONFIG.COMPANY.STATE} Registration</GSTREGISTRATION>\n`;
    xml += `      <CMPGSTIN>${CONFIG.COMPANY.GSTIN}</CMPGSTIN>\n`;
    xml += `      <PARTYLEDGERNAME>${paymentMode}</PARTYLEDGERNAME>\n`;
    xml += `      <VOUCHERNUMBER>${billNumber}</VOUCHERNUMBER>\n`;
    xml += `      <BASICBUYERNAME>${paymentMode}</BASICBUYERNAME>\n`;
    xml += `      <CMPGSTREGISTRATIONTYPE>Regular</CMPGSTREGISTRATIONTYPE>\n`;
    xml += `      <PARTYMAILINGNAME>${paymentMode}</PARTYMAILINGNAME>\n`;
    xml += `      <CONSIGNEEMAILINGNAME>${paymentMode}</CONSIGNEEMAILINGNAME>\n`;
    xml += `      <CONSIGNEESTATENAME>${CONFIG.COMPANY.STATE}</CONSIGNEESTATENAME>\n`;
    xml += `      <CMPGSTSTATE>${CONFIG.COMPANY.STATE}</CMPGSTSTATE>\n`;
    xml += `      <CONSIGNEECOUNTRYNAME>${CONFIG.COMPANY.COUNTRY}</CONSIGNEECOUNTRYNAME>\n`;
    xml += `      <BASICBASEPARTYNAME>${paymentMode}</BASICBASEPARTYNAME>\n`;
    xml += `      <NUMBERINGSTYLE>Automatic (Manual Override)</NUMBERINGSTYLE>\n`;
    xml += `      <CSTFORMISSUETYPE>&#4; Not Applicable</CSTFORMISSUETYPE>\n`;
    xml += `      <CSTFORMRECVTYPE>&#4; Not Applicable</CSTFORMRECVTYPE>\n`;
    xml += `      <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>\n`;
    xml += `      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>\n`;
    xml += `      <VCHSTATUSTAXADJUSTMENT>Default</VCHSTATUSTAXADJUSTMENT>\n`;
    xml += `      <VCHSTATUSVOUCHERTYPE>${CONFIG.VOUCHER.TYPE}</VCHSTATUSVOUCHERTYPE>\n`;
    xml += `      <VCHSTATUSTAXUNIT>${CONFIG.COMPANY.STATE} Registration</VCHSTATUSTAXUNIT>\n`;
    xml += `      <VCHGSTCLASS>&#4; Not Applicable</VCHGSTCLASS>\n`;
    xml += `      <VCHENTRYMODE>Accounting Invoice</VCHENTRYMODE>\n`;
    xml += `      <DIFFACTUALQTY>No</DIFFACTUALQTY>\n`;
    xml += `      <ISMSTFROMSYNC>No</ISMSTFROMSYNC>\n`;
    xml += `      <ISDELETED>No</ISDELETED>\n`;
    xml += `      <ISSECURITYONWHENENTERED>Yes</ISSECURITYONWHENENTERED>\n`;
    xml += `      <ASORIGINAL>No</ASORIGINAL>\n`;
    xml += `      <AUDITED>No</AUDITED>\n`;
    xml += `      <ISCOMMONPARTY>Yes</ISCOMMONPARTY>\n`;
    xml += `      <FORJOBCOSTING>No</FORJOBCOSTING>\n`;
    xml += `      <ISOPTIONAL>No</ISOPTIONAL>\n`;
    xml += `      <EFFECTIVEDATE>${dateFormatted}</EFFECTIVEDATE>\n`;
    xml += `      <USEFOREXCISE>No</USEFOREXCISE>\n`;
    xml += `      <ISFORJOBWORKIN>No</ISFORJOBWORKIN>\n`;
    xml += `      <ALLOWCONSUMPTION>No</ALLOWCONSUMPTION>\n`;
    xml += `      <USEFORINTEREST>No</USEFORINTEREST>\n`;
    xml += `      <USEFORGAINLOSS>No</USEFORGAINLOSS>\n`;
    xml += `      <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>\n`;
    xml += `      <USEFORCOMPOUND>No</USEFORCOMPOUND>\n`;
    xml += `      <USEFORSERVICETAX>No</USEFORSERVICETAX>\n`;
    xml += `      <ISREVERSECHARGEAPPLICABLE>No</ISREVERSECHARGEAPPLICABLE>\n`;
    xml += `      <ISSYSTEM>No</ISSYSTEM>\n`;
    xml += `      <ISFETCHEDONLY>No</ISFETCHEDONLY>\n`;
    xml += `      <ISGSTOVERRIDDEN>No</ISGSTOVERRIDDEN>\n`;
    xml += `      <ISCANCELLED>No</ISCANCELLED>\n`;
    xml += `      <ISONHOLD>No</ISONHOLD>\n`;
    xml += `      <ISSUMMARY>No</ISSUMMARY>\n`;
    xml += `      <ISECOMMERCESUPPLY>No</ISECOMMERCESUPPLY>\n`;
    xml += `      <ISBOENOTAPPLICABLE>No</ISBOENOTAPPLICABLE>\n`;
    xml += `      <ISGSTSECSEVENAPPLICABLE>No</ISGSTSECSEVENAPPLICABLE>\n`;
    xml += `      <IGNOREEINVVALIDATION>No</IGNOREEINVVALIDATION>\n`;
    xml += `      <CMPGSTISOTHTERRITORYASSESSEE>No</CMPGSTISOTHTERRITORYASSESSEE>\n`;
    xml += `      <PARTYGSTISOTHTERRITORYASSESSEE>No</PARTYGSTISOTHTERRITORYASSESSEE>\n`;
    xml += `      <IRNJSONEXPORTED>No</IRNJSONEXPORTED>\n`;
    xml += `      <IRNCANCELLED>No</IRNCANCELLED>\n`;
    xml += `      <IGNOREGSTCONFLICTINMIG>No</IGNOREGSTCONFLICTINMIG>\n`;
    xml += `      <ISOPBALTRANSACTION>No</ISOPBALTRANSACTION>\n`;
    xml += `      <IGNOREGSTFORMATVALIDATION>No</IGNOREGSTFORMATVALIDATION>\n`;
    xml += `      <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>\n`;
    xml += `      <IGNOREGSTOPTIONALUNCERTAIN>No</IGNOREGSTOPTIONALUNCERTAIN>\n`;
    xml += `      <UPDATESUMMARYVALUES>No</UPDATESUMMARYVALUES>\n`;
    xml += `      <ISEWAYBILLAPPLICABLE>No</ISEWAYBILLAPPLICABLE>\n`;
    xml += `      <ISDELETEDRETAINED>No</ISDELETEDRETAINED>\n`;
    xml += `      <ISNULL>No</ISNULL>\n`;
    xml += `      <ISEXCISEVOUCHER>No</ISEXCISEVOUCHER>\n`;
    xml += `      <EXCISETAXOVERRIDE>No</EXCISETAXOVERRIDE>\n`;
    xml += `      <USEFORTAXUNITTRANSFER>No</USEFORTAXUNITTRANSFER>\n`;
    xml += `      <ISEXER1NOPOVERWRITE>No</ISEXER1NOPOVERWRITE>\n`;
    xml += `      <ISEXF2NOPOVERWRITE>No</ISEXF2NOPOVERWRITE>\n`;
    xml += `      <ISEXER3NOPOVERWRITE>No</ISEXER3NOPOVERWRITE>\n`;
    xml += `      <IGNOREPOSVALIDATION>No</IGNOREPOSVALIDATION>\n`;
    xml += `      <EXCISEOPENING>No</EXCISEOPENING>\n`;
    xml += `      <USEFORFINALPRODUCTION>No</USEFORFINALPRODUCTION>\n`;
    xml += `      <ISTDSOVERRIDDEN>No</ISTDSOVERRIDDEN>\n`;
    xml += `      <ISTCSOVERRIDDEN>No</ISTCSOVERRIDDEN>\n`;
    xml += `      <ISTDSTCSCASHVCH>No</ISTDSTCSCASHVCH>\n`;
    xml += `      <INCLUDEADVPYMTVCH>No</INCLUDEADVPYMTVCH>\n`;
    xml += `      <ISSUBWORKSCONTRACT>No</ISSUBWORKSCONTRACT>\n`;
    xml += `      <ISVATOVERRIDDEN>No</ISVATOVERRIDDEN>\n`;
    xml += `      <IGNOREORIGVCHDATE>No</IGNOREORIGVCHDATE>\n`;
    xml += `      <ISVATPAIDATCUSTOMS>No</ISVATPAIDATCUSTOMS>\n`;
    xml += `      <ISDECLAREDTOCUSTOMS>No</ISDECLAREDTOCUSTOMS>\n`;
    xml += `      <VATADVANCEPAYMENT>No</VATADVANCEPAYMENT>\n`;
    xml += `      <VATADVPAY>No</VATADVPAY>\n`;
    xml += `      <ISCSTDELCAREDGOODSSALES>No</ISCSTDELCAREDGOODSSALES>\n`;
    xml += `      <ISVATRESTAXINV>No</ISVATRESTAXINV>\n`;
    xml += `      <ISSERVICETAXOVERRIDDEN>No</ISSERVICETAXOVERRIDDEN>\n`;
    xml += `      <ISISDVOUCHER>No</ISISDVOUCHER>\n`;
    xml += `      <ISEXCISEOVERRIDDEN>No</ISEXCISEOVERRIDDEN>\n`;
    xml += `      <ISEXCISESUPPLYVCH>No</ISEXCISESUPPLYVCH>\n`;
    xml += `      <GSTNOTEXPORTED>No</GSTNOTEXPORTED>\n`;
    xml += `      <IGNOREGSTINVALIDATION>No</IGNOREGSTINVALIDATION>\n`;
    xml += `      <ISGSTREFUND>No</ISGSTREFUND>\n`;
    xml += `      <OVRDNEWAYBILLAPPLICABILITY>No</OVRDNEWAYBILLAPPLICABILITY>\n`;
    xml += `      <ISVATPRINCIPALACCOUNT>No</ISVATPRINCIPALACCOUNT>\n`;
    xml += `      <VCHSTATUSISVCHNUMUSED>No</VCHSTATUSISVCHNUMUSED>\n`;
    xml += `      <VCHGSTSTATUSISINCLUDED>Yes</VCHGSTSTATUSISINCLUDED>\n`;
    xml += `      <VCHGSTSTATUSISUNCERTAIN>No</VCHGSTSTATUSISUNCERTAIN>\n`;
    xml += `      <VCHGSTSTATUSISEXCLUDED>No</VCHGSTSTATUSISEXCLUDED>\n`;
    xml += `      <VCHGSTSTATUSISAPPLICABLE>Yes</VCHGSTSTATUSISAPPLICABLE>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BRECONCILED>No</VCHGSTSTATUSISGSTR2BRECONCILED>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BONLYINPORTAL>No</VCHGSTSTATUSISGSTR2BONLYINPORTAL>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BONLYINBOOKS>No</VCHGSTSTATUSISGSTR2BONLYINBOOKS>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BMISMATCH>No</VCHGSTSTATUSISGSTR2BMISMATCH>\n`;
    xml += `      <VCHGSTSTATUSISGSTR2BINDIFFPERIOD>No</VCHGSTSTATUSISGSTR2BINDIFFPERIOD>\n`;
    xml += `      <VCHGSTSTATUSISRETEFFDATEOVERRDN>No</VCHGSTSTATUSISRETEFFDATEOVERRDN>\n`;
    xml += `      <VCHGSTSTATUSISOVERRDN>No</VCHGSTSTATUSISOVERRDN>\n`;
    xml += `      <VCHGSTSTATUSISSTATINDIFFDATE>No</VCHGSTSTATUSISSTATINDIFFDATE>\n`;
    xml += `      <VCHGSTSTATUSISRETINDIFFDATE>No</VCHGSTSTATUSISRETINDIFFDATE>\n`;
    xml += `      <VCHGSTSTATUSMAINSECTIONEXCLUDED>No</VCHGSTSTATUSMAINSECTIONEXCLUDED>\n`;
    xml += `      <VCHGSTSTATUSISBRANCHTRANSFEROUT>No</VCHGSTSTATUSISBRANCHTRANSFEROUT>\n`;
    xml += `      <VCHGSTSTATUSISSYSTEMSUMMARY>No</VCHGSTSTATUSISSYSTEMSUMMARY>\n`;
    xml += `      <VCHSTATUSISUNREGISTEREDRCM>No</VCHSTATUSISUNREGISTEREDRCM>\n`;
    xml += `      <VCHSTATUSISOPTIONAL>No</VCHSTATUSISOPTIONAL>\n`;
    xml += `      <VCHSTATUSISCANCELLED>No</VCHSTATUSISCANCELLED>\n`;
    xml += `      <VCHSTATUSISDELETED>No</VCHSTATUSISDELETED>\n`;
    xml += `      <VCHSTATUSISOPENINGBALANCE>No</VCHSTATUSISOPENINGBALANCE>\n`;
    xml += `      <VCHSTATUSISFETCHEDONLY>No</VCHSTATUSISFETCHEDONLY>\n`;
    xml += `      <VCHGSTSTATUSISOPTIONALUNCERTAIN>No</VCHGSTSTATUSISOPTIONALUNCERTAIN>\n`;
    xml += `      <VCHSTATUSISREACCEPTFORHSNDONE>No</VCHSTATUSISREACCEPTFORHSNDONE>\n`;
    xml += `      <VCHSTATUSISREACCEPHSNSIXONEDONE>Yes</VCHSTATUSISREACCEPHSNSIXONEDONE>\n`;
    xml += `      <PAYMENTLINKHASMULTIREF>No</PAYMENTLINKHASMULTIREF>\n`;
    xml += `      <ISSHIPPINGWITHINSTATE>No</ISSHIPPINGWITHINSTATE>\n`;
    xml += `      <ISOVERSEASTOURISTTRANS>No</ISOVERSEASTOURISTTRANS>\n`;
    xml += `      <ISDESIGNATEDZONEPARTY>No</ISDESIGNATEDZONEPARTY>\n`;
    xml += `      <HASCASHFLOW>Yes</HASCASHFLOW>\n`;
    xml += `      <ISPOSTDATED>No</ISPOSTDATED>\n`;
    xml += `      <USETRACKINGNUMBER>No</USETRACKINGNUMBER>\n`;
    xml += `      <ISINVOICE>Yes</ISINVOICE>\n`;
    xml += `      <MFGJOURNAL>No</MFGJOURNAL>\n`;
    xml += `      <HASDISCOUNTS>No</HASDISCOUNTS>\n`;
    xml += `      <ASPAYSLIP>No</ASPAYSLIP>\n`;
    xml += `      <ISCOSTCENTRE>No</ISCOSTCENTRE>\n`;
    xml += `      <ISSTXNONREALIZEDVCH>No</ISSTXNONREALIZEDVCH>\n`;
    xml += `      <ISEXCISEMANUFACTURERON>No</ISEXCISEMANUFACTURERON>\n`;
    xml += `      <ISBLANKCHEQUE>No</ISBLANKCHEQUE>\n`;
    xml += `      <ISVOID>No</ISVOID>\n`;
    xml += `      <ORDERLINESTATUS>No</ORDERLINESTATUS>\n`;
    xml += `      <VATISAGNSTCANCSALES>No</VATISAGNSTCANCSALES>\n`;
    xml += `      <VATISPURCEXEMPTED>No</VATISPURCEXEMPTED>\n`;
    xml += `      <ISVATRESTAXINVOICE>No</ISVATRESTAXINVOICE>\n`;
    xml += `      <VATISASSESABLECALCVCH>No</VATISASSESABLECALCVCH>\n`;
    xml += `      <ISVATDUTYPAID>Yes</ISVATDUTYPAID>\n`;
    xml += `      <ISDELIVERYSAMEASCONSIGNEE>No</ISDELIVERYSAMEASCONSIGNEE>\n`;
    xml += `      <ISDISPATCHSAMEASCONSIGNOR>No</ISDISPATCHSAMEASCONSIGNOR>\n`;
    xml += `      <ISDELETEDVCHRETAINED>No</ISDELETEDVCHRETAINED>\n`;
    xml += `      <VCHONLYADDLINFOUPDATED>No</VCHONLYADDLINFOUPDATED>\n`;
    xml += `      <CHANGEVCHMODE>No</CHANGEVCHMODE>\n`;
    xml += `      <RESETIRNQRCODE>No</RESETIRNQRCODE>\n`;
    xml += `      <VOUCHERNUMBERSERIES>Default</VOUCHERNUMBERSERIES>\n`;
    xml += `      <EWAYBILLDETAILS.LIST>      </EWAYBILLDETAILS.LIST>\n`;
    xml += `      <EXCLUDEDTAXATIONS.LIST>      </EXCLUDEDTAXATIONS.LIST>\n`;
    xml += `      <OLDAUDITENTRIES.LIST>      </OLDAUDITENTRIES.LIST>\n`;
    xml += `      <ACCOUNTAUDITENTRIES.LIST>      </ACCOUNTAUDITENTRIES.LIST>\n`;
    xml += `      <AUDITENTRIES.LIST>      </AUDITENTRIES.LIST>\n`;
    xml += `      <DUTYHEADDETAILS.LIST>      </DUTYHEADDETAILS.LIST>\n`;
    xml += `      <GSTADVADJDETAILS.LIST>      </GSTADVADJDETAILS.LIST>\n`;
    xml += `      <ALLINVENTORYENTRIES.LIST>      </ALLINVENTORYENTRIES.LIST>\n`;
    xml += `      <CONTRITRANS.LIST>      </CONTRITRANS.LIST>\n`;
    xml += `      <EWAYBILLERRORLIST.LIST>      </EWAYBILLERRORLIST.LIST>\n`;
    xml += `      <IRNERRORLIST.LIST>      </IRNERRORLIST.LIST>\n`;
    xml += `      <HARYANAVAT.LIST>      </HARYANAVAT.LIST>\n`;
    xml += `      <SUPPLEMENTARYDUTYHEADDETAILS.LIST>      </SUPPLEMENTARYDUTYHEADDETAILS.LIST>\n`;
    xml += `      <INVOICEDELNOTES.LIST>      </INVOICEDELNOTES.LIST>\n`;
    xml += `      <INVOICEORDERLIST.LIST>      </INVOICEORDERLIST.LIST>\n`;
    xml += `      <INVOICEINDENTLIST.LIST>      </INVOICEINDENTLIST.LIST>\n`;
    xml += `      <ATTENDANCEENTRIES.LIST>      </ATTENDANCEENTRIES.LIST>\n`;
    xml += `      <ORIGINVOICEDETAILS.LIST>      </ORIGINVOICEDETAILS.LIST>\n`;
    xml += `      <INVOICEEXPORTLIST.LIST>      </INVOICEEXPORTLIST.LIST>\n`;

    // 1. PARTY LEDGER (Mode of Payment)
    xml += `      <LEDGERENTRIES.LIST>\n`;
    xml += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
    xml += `        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
    xml += `       </OLDAUDITENTRYIDS.LIST>\n`;
    xml += `       <LEDGERNAME>${paymentMode}</LEDGERNAME>\n`;
    xml += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
    xml += `       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
    xml += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
    xml += `       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>\n`;
    xml += `       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>\n`;
    xml += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
    xml += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
    xml += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
    xml += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
    xml += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
    xml += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
    xml += `       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>\n`;
    xml += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
    xml += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
    xml += `       <AMOUNT>-${targetTotal.toFixed(2)}</AMOUNT>\n`;
    xml += `       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>\n`;
    xml += `       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>\n`;
    xml += `       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>\n`;
    xml += `       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>\n`;
    xml += `       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>\n`;
    xml += `       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>\n`;
    xml += `       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>\n`;
    xml += `       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>\n`;
    xml += `       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>\n`;
    xml += `       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>\n`;
    xml += `       <RATEDETAILS.LIST>       </RATEDETAILS.LIST>\n`;
    xml += `       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>\n`;
    xml += `       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>\n`;
    xml += `       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>\n`;
    xml += `       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>\n`;
    xml += `       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>\n`;
    xml += `       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>\n`;
    xml += `       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>\n`;
    xml += `       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>\n`;
    xml += `       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>\n`;
    xml += `       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>\n`;
    xml += `       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>\n`;
    xml += `       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>\n`;
    xml += `       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>\n`;
    xml += `       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>\n`;
    xml += `      </LEDGERENTRIES.LIST>\n`;

    // 2. SALES LEDGER
    if (salesAmount > 0) {
        xml += `      <LEDGERENTRIES.LIST>\n`;
        xml += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
        xml += `        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
        xml += `       </OLDAUDITENTRYIDS.LIST>\n`;
        xml += `       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>\n`;
        xml += `       <LEDGERNAME>${CONFIG.LEDGERS.SALES}</LEDGERNAME>\n`;
        xml += `       <METHODTYPE>On Total Sales</METHODTYPE>\n`;
        xml += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
        xml += `       <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>\n`;
        xml += `       <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>\n`;
        xml += `       <GSTSOURCETYPE>Ledger</GSTSOURCETYPE>\n`;
        xml += `       <GSTLEDGERSOURCE>${CONFIG.LEDGERS.SALES}</GSTLEDGERSOURCE>\n`;
        xml += `       <HSNSOURCETYPE>Ledger</HSNSOURCETYPE>\n`;
        xml += `       <HSNLEDGERSOURCE>${CONFIG.LEDGERS.SALES}</HSNLEDGERSOURCE>\n`;
        xml += `       <GSTOVRDNSTOREDNATURE>Local Sales - Taxable</GSTOVRDNSTOREDNATURE>\n`;
        xml += `       <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>\n`;
        xml += `       <GSTRATEINFERAPPLICABILITY>As per Masters/Company</GSTRATEINFERAPPLICABILITY>\n`;
        xml += `       <GSTHSNNAME>${CONFIG.TAX_INFO.SALES_HSN}</GSTHSNNAME>\n`;
        xml += `       <GSTHSNINFERAPPLICABILITY>As per Masters/Company</GSTHSNINFERAPPLICABILITY>\n`;
        xml += `       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
        xml += `       <REMOVEZEROENTRIES>Yes</REMOVEZEROENTRIES>\n`;
        xml += `       <ISPARTYLEDGER>No</ISPARTYLEDGER>\n`;
        xml += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
        xml += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
        xml += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
        xml += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
        xml += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
        xml += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
        xml += `       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>\n`;
        xml += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
        xml += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
        xml += `       <AMOUNT>${salesAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `       <VATEXPAMOUNT>${salesAmount.toFixed(2)}</VATEXPAMOUNT>\n`;
        xml += `       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>\n`;
        xml += `       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>\n`;
        xml += `       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>\n`;
        xml += `       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>\n`;
        xml += `       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>\n`;
        xml += `       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>\n`;
        xml += `       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>\n`;
        xml += `       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>\n`;
        xml += `       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>\n`;
        xml += `       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `        <GSTRATE> 9</GSTRATE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `        <GSTRATE> 9</GSTRATE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `        <GSTRATE> 18</GSTRATE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>&#4; Not Applicable</GSTRATEVALUATIONTYPE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>\n`;
        xml += `       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>\n`;
        xml += `       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>\n`;
        xml += `       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>\n`;
        xml += `       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>\n`;
        xml += `       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>\n`;
        xml += `       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>\n`;
        xml += `       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>\n`;
        xml += `       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>\n`;
        xml += `       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>\n`;
        xml += `       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>\n`;
        xml += `       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>\n`;
        xml += `       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>\n`;
        xml += `       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>\n`;
        xml += `      </LEDGERENTRIES.LIST>\n`;
    }

    // 3. LABOUR CHARGES
    if (labourAmount > 0) {
        xml += `      <LEDGERENTRIES.LIST>\n`;
        xml += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
        xml += `        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
        xml += `       </OLDAUDITENTRYIDS.LIST>\n`;
        xml += `       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>\n`;
        xml += `       <LEDGERNAME>${CONFIG.LEDGERS.LABOUR}</LEDGERNAME>\n`;
        xml += `       <METHODTYPE>On Total Sales</METHODTYPE>\n`;
        xml += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
        xml += `       <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>\n`;
        xml += `       <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>\n`;
        xml += `       <GSTSOURCETYPE>Ledger</GSTSOURCETYPE>\n`;
        xml += `       <GSTLEDGERSOURCE>${CONFIG.LEDGERS.LABOUR}</GSTLEDGERSOURCE>\n`;
        xml += `       <HSNSOURCETYPE>Ledger</HSNSOURCETYPE>\n`;
        xml += `       <HSNLEDGERSOURCE>${CONFIG.LEDGERS.LABOUR}</HSNLEDGERSOURCE>\n`;
        xml += `       <GSTOVRDNSTOREDNATURE>Local Sales - Taxable</GSTOVRDNSTOREDNATURE>\n`;
        xml += `       <GSTOVRDNTYPEOFSUPPLY>Services</GSTOVRDNTYPEOFSUPPLY>\n`;
        xml += `       <GSTRATEINFERAPPLICABILITY>As per Masters/Company</GSTRATEINFERAPPLICABILITY>\n`;
        xml += `       <GSTHSNNAME>${CONFIG.TAX_INFO.LABOUR_HSN}</GSTHSNNAME>\n`;
        xml += `       <GSTHSNDESCRIPTION>${CONFIG.TAX_INFO.LABOUR_DESC}</GSTHSNDESCRIPTION>\n`;
        xml += `       <GSTHSNINFERAPPLICABILITY>As per Masters/Company</GSTHSNINFERAPPLICABILITY>\n`;
        xml += `       <GSTDEPGSTCLASSIFICATION>Labour Charges</GSTDEPGSTCLASSIFICATION>\n`;
        xml += `       <GSTDEPHSNCLASSIFICATION>Labour Charges</GSTDEPHSNCLASSIFICATION>\n`;
        xml += `       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
        xml += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
        xml += `       <REMOVEZEROENTRIES>Yes</REMOVEZEROENTRIES>\n`;
        xml += `       <ISPARTYLEDGER>No</ISPARTYLEDGER>\n`;
        xml += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
        xml += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
        xml += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
        xml += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
        xml += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
        xml += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
        xml += `       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>\n`;
        xml += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
        xml += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
        xml += `       <AMOUNT>${labourAmount.toFixed(2)}</AMOUNT>\n`;
        xml += `       <VATEXPAMOUNT>${labourAmount.toFixed(2)}</VATEXPAMOUNT>\n`;
        xml += `       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>\n`;
        xml += `       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>\n`;
        xml += `       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>\n`;
        xml += `       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>\n`;
        xml += `       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>\n`;
        xml += `       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>\n`;
        xml += `       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>\n`;
        xml += `       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>\n`;
        xml += `       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>\n`;
        xml += `       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `        <GSTRATE> 9</GSTRATE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `        <GSTRATE> 9</GSTRATE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `        <GSTRATE> 18</GSTRATE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>&#4; Not Applicable</GSTRATEVALUATIONTYPE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>\n`;
        xml += `        <GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD>\n`;
        xml += `        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n`;
        xml += `       </RATEDETAILS.LIST>\n`;
        xml += `       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>\n`;
        xml += `       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>\n`;
        xml += `       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>\n`;
        xml += `       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>\n`;
        xml += `       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>\n`;
        xml += `       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>\n`;
        xml += `       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>\n`;
        xml += `       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>\n`;
        xml += `       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>\n`;
        xml += `       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>\n`;
        xml += `       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>\n`;
        xml += `       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>\n`;
        xml += `       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>\n`;
        xml += `       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>\n`;
        xml += `      </LEDGERENTRIES.LIST>\n`;
    }

    // 4. CGST
    xml += `      <LEDGERENTRIES.LIST>\n`;
    xml += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
    xml += `        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
    xml += `       </OLDAUDITENTRYIDS.LIST>\n`;
    xml += `       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>\n`;
    xml += `       <LEDGERNAME>${CONFIG.LEDGERS.CGST}</LEDGERNAME>\n`;
    xml += `       <METHODTYPE>GST</METHODTYPE>\n`;
    xml += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
    xml += `       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
    xml += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
    xml += `       <REMOVEZEROENTRIES>Yes</REMOVEZEROENTRIES>\n`;
    xml += `       <ISPARTYLEDGER>No</ISPARTYLEDGER>\n`;
    xml += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
    xml += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
    xml += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
    xml += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
    xml += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
    xml += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
    xml += `       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>\n`;
    xml += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
    xml += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
    xml += `       <AMOUNT>${totalCgst.toFixed(2)}</AMOUNT>\n`;
    xml += `       <VATEXPAMOUNT>${totalCgst.toFixed(2)}</VATEXPAMOUNT>\n`;
    xml += `       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>\n`;
    xml += `       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>\n`;
    xml += `       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>\n`;
    xml += `       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>\n`;
    xml += `       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>\n`;
    xml += `       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>\n`;
    xml += `       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>\n`;
    xml += `       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>\n`;
    xml += `       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>\n`;
    xml += `       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>\n`;
    xml += `       <RATEDETAILS.LIST>       </RATEDETAILS.LIST>\n`;
    xml += `       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>\n`;
    xml += `       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>\n`;
    xml += `       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>\n`;
    xml += `       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>\n`;
    xml += `       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>\n`;
    xml += `       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>\n`;
    xml += `       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>\n`;
    xml += `       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>\n`;
    xml += `       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>\n`;
    xml += `       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>\n`;
    xml += `       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>\n`;
    xml += `       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>\n`;
    xml += `       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>\n`;
    xml += `       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>\n`;
    xml += `      </LEDGERENTRIES.LIST>\n`;

    // 5. SGST
    xml += `      <LEDGERENTRIES.LIST>\n`;
    xml += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
    xml += `        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
    xml += `       </OLDAUDITENTRYIDS.LIST>\n`;
    xml += `       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>\n`;
    xml += `       <LEDGERNAME>${CONFIG.LEDGERS.SGST}</LEDGERNAME>\n`;
    xml += `       <METHODTYPE>GST</METHODTYPE>\n`;
    xml += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
    xml += `       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
    xml += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
    xml += `       <REMOVEZEROENTRIES>Yes</REMOVEZEROENTRIES>\n`;
    xml += `       <ISPARTYLEDGER>No</ISPARTYLEDGER>\n`;
    xml += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
    xml += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
    xml += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
    xml += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
    xml += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
    xml += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
    xml += `       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>\n`;
    xml += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
    xml += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
    xml += `       <AMOUNT>${totalSgst.toFixed(2)}</AMOUNT>\n`;
    xml += `       <VATEXPAMOUNT>${totalSgst.toFixed(2)}</VATEXPAMOUNT>\n`;
    xml += `       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>\n`;
    xml += `       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>\n`;
    xml += `       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>\n`;
    xml += `       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>\n`;
    xml += `       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>\n`;
    xml += `       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>\n`;
    xml += `       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>\n`;
    xml += `       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>\n`;
    xml += `       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>\n`;
    xml += `       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>\n`;
    xml += `       <RATEDETAILS.LIST>       </RATEDETAILS.LIST>\n`;
    xml += `       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>\n`;
    xml += `       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>\n`;
    xml += `       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>\n`;
    xml += `       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>\n`;
    xml += `       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>\n`;
    xml += `       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>\n`;
    xml += `       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>\n`;
    xml += `       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>\n`;
    xml += `       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>\n`;
    xml += `       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>\n`;
    xml += `       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>\n`;
    xml += `       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>\n`;
    xml += `       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>\n`;
    xml += `       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>\n`;
    xml += `      </LEDGERENTRIES.LIST>\n`;

    // 6. ROUND OFF
    if (Math.abs(roundOff) >= 0.01) {
        xml += `      <LEDGERENTRIES.LIST>\n`;
        xml += `       <OLDAUDITENTRYIDS.LIST TYPE="Number">\n`;
        xml += `        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>\n`;
        xml += `       </OLDAUDITENTRYIDS.LIST>\n`;
        xml += `       <ROUNDTYPE>Normal Rounding</ROUNDTYPE>\n`;
        xml += `       <LEDGERNAME>${CONFIG.LEDGERS.ROUND_OFF}</LEDGERNAME>\n`;
        xml += `       <METHODTYPE>As Total Amount Rounding</METHODTYPE>\n`;
        xml += `       <GSTCLASS>&#4; Not Applicable</GSTCLASS>\n`;
        xml += `       <ISDEEMEDPOSITIVE>${roundOffIsDeemedPositive}</ISDEEMEDPOSITIVE>\n`;
        xml += `       <LEDGERFROMITEM>No</LEDGERFROMITEM>\n`;
        xml += `       <REMOVEZEROENTRIES>Yes</REMOVEZEROENTRIES>\n`;
        xml += `       <ISPARTYLEDGER>No</ISPARTYLEDGER>\n`;
        xml += `       <GSTOVERRIDDEN>No</GSTOVERRIDDEN>\n`;
        xml += `       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>\n`;
        xml += `       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>\n`;
        xml += `       <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>\n`;
        xml += `       <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>\n`;
        xml += `       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>\n`;
        xml += `       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>\n`;
        xml += `       <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>\n`;
        xml += `       <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>\n`;
        xml += `       <ROUNDLIMIT> 1</ROUNDLIMIT>\n`;
        xml += `       <AMOUNT>${roundOffAmountStr}</AMOUNT>\n`;
        xml += `       <VATEXPAMOUNT>${roundOffAmountStr}</VATEXPAMOUNT>\n`;
        xml += `       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>\n`;
        xml += `       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>\n`;
        xml += `       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>\n`;
        xml += `       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>\n`;
        xml += `       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>\n`;
        xml += `       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>\n`;
        xml += `       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>\n`;
        xml += `       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>\n`;
        xml += `       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>\n`;
        xml += `       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>\n`;
        xml += `       <RATEDETAILS.LIST>       </RATEDETAILS.LIST>\n`;
        xml += `       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>\n`;
        xml += `       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>\n`;
        xml += `       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>\n`;
        xml += `       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>\n`;
        xml += `       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>\n`;
        xml += `       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>\n`;
        xml += `       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>\n`;
        xml += `       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>\n`;
        xml += `       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>\n`;
        xml += `       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>\n`;
        xml += `       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>\n`;
        xml += `       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>\n`;
        xml += `       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>\n`;
        xml += `       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>\n`;
        xml += `      </LEDGERENTRIES.LIST>\n`;
    }

    // Tally Lists closings
    xml += `      <GST.LIST>\n`;
    xml += `       <PURPOSETYPE>GST</PURPOSETYPE>\n`;
    xml += `       <STAT.LIST>\n`;
    xml += `        <PURPOSETYPE>GST</PURPOSETYPE>\n`;
    xml += `        <STATKEY>&#4; Auto Stat Number</STATKEY>\n`;
    xml += `        <ISFETCHEDONLY>No</ISFETCHEDONLY>\n`;
    xml += `        <ISDELETED>No</ISDELETED>\n`;
    xml += `        <TALLYCONTENTUSER.LIST>        </TALLYCONTENTUSER.LIST>\n`;
    xml += `       </STAT.LIST>\n`;
    xml += `      </GST.LIST>\n`;
    xml += `      <STKJRNLADDLCOSTDETAILS.LIST>       </STKJRNLADDLCOSTDETAILS.LIST>\n`;
    xml += `      <PAYROLLMODEOFPAYMENT.LIST>       </PAYROLLMODEOFPAYMENT.LIST>\n`;
    xml += `      <ATTDRECORDS.LIST>       </ATTDRECORDS.LIST>\n`;
    xml += `      <GSTEWAYCONSIGNORADDRESS.LIST>       </GSTEWAYCONSIGNORADDRESS.LIST>\n`;
    xml += `      <GSTEWAYCONSIGNEEADDRESS.LIST>       </GSTEWAYCONSIGNEEADDRESS.LIST>\n`;
    xml += `      <TEMPGSTRATEDETAILS.LIST>       </TEMPGSTRATEDETAILS.LIST>\n`;
    xml += `      <TEMPGSTADVADJUSTED.LIST>       </TEMPGSTADVADJUSTED.LIST>\n`;
    xml += `      <GSTBUYERADDRESS.LIST>       </GSTBUYERADDRESS.LIST>\n`;
    xml += `      <GSTCONSIGNEEADDRESS.LIST>       </GSTCONSIGNEEADDRESS.LIST>\n`;
    xml += `     </VOUCHER>\n`;
    xml += `    </TALLYMESSAGE>\n`;
    
    return xml;
}
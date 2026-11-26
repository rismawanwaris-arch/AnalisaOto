import ExcelJS from 'exceljs';
import path from 'path';
import { Readable } from 'stream';
import { DEFAULT_OUTLET_GROUPS } from './defaults.js';

/**
 * Classifies an outlet/reseller and sender ID into a structured Outlet Group & extracts Outlet Code
 */
export function evaluateOutlet(resellerName, pengirim) {
  const rawName = String(resellerName || 'Tanpa Nama').trim();
  const upperName = rawName.toUpperCase().replace(/\s+/g, ' ');
  const rawSender = String(pengirim || '').trim();
  const upperSender = rawSender.toUpperCase();

  // Extract clean Outlet / Agent ID from Pengirim (e.g. android/PLC106 -> PLC106)
  let outletCode = '-';
  const senderMatch = upperSender.match(/(?:ANDROID\/)?([A-Z]{2,4}\d+)/);
  if (senderMatch) {
    outletCode = senderMatch[1];
  } else if (upperSender.includes('@')) {
    outletCode = 'SIMOBILE';
  }

  let groupId = 'non_plc_kbb';
  let isOfficialOutlet = false;
  let subCluster = 'Non-Cabang';

  if (upperName.startsWith('PLC') || outletCode.startsWith('PLC')) {
    isOfficialOutlet = true;
    groupId = 'out_plc';
    if (upperName.includes('ALFA')) {
      subCluster = 'PLC Klaster ALFA';
    } else if (upperName.includes(' BK')) {
      subCluster = 'PLC Klaster BK';
    } else if (
      upperName.includes(' PD') ||
      upperName.includes('ASBER') ||
      upperName.includes('BAKSAR') ||
      upperName.includes('CIKADUT')
    ) {
      subCluster = 'PLC Klaster PD/ASBER/BAKSAR';
    } else if (upperName.includes(' CL') || upperName.includes(' PC')) {
      subCluster = 'PLC Klaster CL & PC';
    } else {
      subCluster = 'PLC Cabang Reguler';
    }
  } else if (upperName.startsWith('KBB') || outletCode.startsWith('KBB')) {
    isOfficialOutlet = true;
    groupId = 'out_kbb';
    subCluster = 'Cabang Wilayah KBB';
  }

  const groupMeta = DEFAULT_OUTLET_GROUPS.find((g) => g.id === groupId) || {
    id: 'non_plc_kbb',
    name: 'Reseller Non-PLC/KBB',
    shortName: 'Non-PLC/KBB',
    color: '#64748b',
    type: 'NON_PLC_KBB',
  };

  return {
    outletName: rawName,
    outletCode,
    groupId: groupMeta.id,
    groupName: groupMeta.name,
    groupShortName: groupMeta.shortName,
    groupColor: groupMeta.color,
    groupType: groupMeta.type,
    subCluster,
    isOfficialOutlet,
  };
}


/**
 * Pre-compiles rules once per request/batch to avoid per-row filtering & sorting.
 */
export function compileRules(rules = []) {
  if (rules && rules.__compiled) return rules;
  const exactMap = new Map();
  const moduleRules = [];
  const prefixRules = [];

  for (const r of rules || []) {
    if (!r) continue;
    const pat = String(r.pattern || '').trim().toUpperCase();
    if (!pat) continue;
    if (r.matchType === 'exact') {
      if (!exactMap.has(pat)) {
        exactMap.set(pat, r);
      }
    } else if (r.matchType === 'module') {
      moduleRules.push({ rule: r, pat });
    } else if (r.matchType === 'prefix') {
      prefixRules.push({ rule: r, pat });
    }
  }

  prefixRules.sort((a, b) => b.pat.length - a.pat.length);

  return {
    __compiled: true,
    exactMap,
    moduleRules,
    prefixRules,
  };
}

/**
 * Evaluates a single transaction's product & module against the active rules dictionary.
 * Priority:
 * 1. Exact product code match
 * 2. Supplier module match (e.g. VOUCHER, INJECT VC)
 * 3. Prefix match sorted by longest pattern first (so TBCA -> TB -> T, SHP -> S, etc.)
 */
export function evaluateProduct(productCode, moduleName, rulesOrCompiled, categoriesMap) {
  const prod = String(productCode || '').trim().toUpperCase();
  const mod = String(moduleName || '').trim().toUpperCase();

  if (!prod) {
    return {
      isCategorized: false,
      categoryId: 'uncategorized',
      categoryName: '[Belum Dikategorikan]',
      subCategory: 'Tidak Dikenali',
      matchedRuleId: null,
    };
  }

  const compiled = rulesOrCompiled?.__compiled
    ? rulesOrCompiled
    : compileRules(rulesOrCompiled || []);

  // 1. Exact Match
  const exactRule = compiled.exactMap.get(prod);
  if (exactRule) {
    const cat = categoriesMap.get(exactRule.categoryId);
    if (cat) {
      return {
        isCategorized: true,
        categoryId: cat.id,
        categoryName: cat.name,
        subCategory: exactRule.subCategory || resolveSmartSubCategory(prod, mod, cat.id),
        matchedRuleId: exactRule.id,
      };
    }
  }

  // 2. Module Match
  if (mod && mod !== '<NULL>') {
    for (const { rule: r, pat } of compiled.moduleRules) {
      if (mod.includes(pat)) {
        const cat = categoriesMap.get(r.categoryId);
        if (cat) {
          return {
            isCategorized: true,
            categoryId: cat.id,
            categoryName: cat.name,
            subCategory: resolveSmartSubCategory(prod, mod, cat.id, r.subCategory),
            matchedRuleId: r.id,
          };
        }
      }
    }
  }

  // 3. Prefix Match (longest prefix first)
  for (const { rule: r, pat } of compiled.prefixRules) {
    if (prod.startsWith(pat)) {
      const cat = categoriesMap.get(r.categoryId);
      if (cat) {
        return {
          isCategorized: true,
          categoryId: cat.id,
          categoryName: cat.name,
          subCategory:
            r.subCategory && r.subCategory !== 'Bank Lainnya'
              ? r.subCategory
              : resolveSmartSubCategory(prod, mod, cat.id, r.subCategory),
          matchedRuleId: r.id,
        };
      }
    }
  }

  return {
    isCategorized: false,
    categoryId: 'uncategorized',
    categoryName: '[Belum Dikategorikan]',
    subCategory: 'Produk Baru (Belum Dipetakan)',
    matchedRuleId: null,
  };
}

/**
 * Provides clean human-readable sub-category labels for drill-down tables
 */
export function resolveSmartSubCategory(prod, mod, categoryId, fallbackSub) {
  if (categoryId === 'cat_transfer_bank') {
    if (prod.startsWith('TBCA') || prod.startsWith('FBANK014')) return 'Bank BCA';
    if (prod.startsWith('TBRI') || prod.startsWith('FBANK002')) return 'Bank BRI';
    if (prod.startsWith('TBMD') || prod.startsWith('FBANK008')) return 'Bank Mandiri';
    if (prod.startsWith('TBSEA') || prod.startsWith('FBANK535')) return 'SeaBank';
    if (prod.startsWith('TBNI') || prod.startsWith('FBANK009')) return 'Bank BNI';
    if (prod.startsWith('TBBSI') || prod.startsWith('FBANK451')) return 'Bank Syariah Indonesia (BSI)';
    if (prod.startsWith('TBJAGO') || prod.startsWith('FBANK542')) return 'Bank Jago';
    if (prod.startsWith('TBTN') || prod.startsWith('FBANK200')) return 'Bank BTN';
    if (prod.startsWith('TBROYAL') || prod.startsWith('FBANK501')) return 'Blu by BCA Digital (Royal)';
    if (prod.startsWith('TBALLO') || prod.startsWith('FBANK562')) return 'Allo Bank';
    if (prod.startsWith('TBNEO') || prod.startsWith('FBANK490')) return 'Bank Neo Commerce (BNC)';
    if (prod.startsWith('TBMUA') || prod.startsWith('FBANK147')) return 'Bank Muamalat';
    if (prod.startsWith('TBOCBC') || prod.startsWith('FBANK028')) return 'Bank OCBC NISP';
    if (prod.startsWith('TBJBS')) return 'Bank BJB / Syariah';
    if (prod.startsWith('TBMSP')) return 'Bank Mega / Maspion';
    if (prod.startsWith('FBANK472')) return 'Bank Jasa Jakarta (Saqu)';
    if (prod.startsWith('TBCIMB')) return 'Bank CIMB Niaga';
    if (prod.startsWith('BNKPERMATA') || prod.startsWith('TBPRM')) return 'Bank Permata';
    return fallbackSub || 'Bank Lainnya';
  }

  if (categoryId === 'cat_ewallet') {
    if (prod.startsWith('DANA')) return 'DANA';
    if (prod.startsWith('GO')) return 'GoPay';
    if (prod.startsWith('SHP') || prod.startsWith('SHOPEE')) return 'ShopeePay';
    if (prod.startsWith('OVO')) return 'OVO';
    if (prod.startsWith('GRAB')) return 'Grab';
    if (prod.startsWith('LINKAJA')) return 'LinkAja';
    if (prod === 'TDOQR' || prod.startsWith('QR')) return 'QRIS & Saldo Digital';
    return fallbackSub || 'E-Wallet Lainnya';
  }

  if (categoryId === 'cat_ppob') {
    if (prod.startsWith('PLN') || prod.startsWith('TKN')) return 'Token Listrik PLN';
    if (prod.startsWith('PPLN')) return 'Tagihan PLN Pascabayar';
    if (prod.startsWith('BPJS')) return 'BPJS Kesehatan';
    if (prod.startsWith('SPDY') || prod.startsWith('INDI')) return 'Internet & Telkom (Speedy/IndiHome)';
    if (prod.startsWith('PDAM')) return 'Tagihan Air PDAM';
    return fallbackSub || 'Tagihan PPOB Lainnya';
  }

  if (categoryId === 'cat_voucher') {
    if (prod.startsWith('VA')) return 'Voucher Axis';
    if (prod.startsWith('VT')) return 'Voucher Tri (3)';
    if (prod.startsWith('VSM') || prod.startsWith('SV')) return 'Voucher Smartfren';
    if (prod.startsWith('VIY') || prod.startsWith('VI')) return 'Voucher Indosat';
    if (prod.startsWith('VS') || prod.startsWith('VTSEL')) return 'Voucher Telkomsel';
    if (prod.startsWith('VX')) return 'Voucher XL';
    return fallbackSub || 'Voucher Fisik / Inject';
  }

  if (categoryId === 'cat_pulsa_data') {
    if (prod.startsWith('BYU')) return 'By.U (Telkomsel Digital)';
    if (prod.startsWith('SR') || prod.startsWith('SM')) return 'Smartfren';
    if (prod.startsWith('AX') || prod.startsWith('AH') || prod.startsWith('AM')) return 'Axis';
    if (prod.startsWith('I')) return 'Indosat Ooredoo';
    if (prod.startsWith('X')) return 'XL Axiata';
    if (prod.startsWith('T')) return 'Tri (3)';
    if (prod.startsWith('S') || prod.startsWith('HDTF') || prod.startsWith('MAXD')) return 'Telkomsel';
    return fallbackSub || 'Operator Seluler Lainnya';
  }

  return fallbackSub || 'Umum';
}

/**
 * Suggests prefix and category for a newly encountered uncategorized product code
 */
export function suggestRuleForProduct(productCode, moduleName) {
  const prod = String(productCode || '').trim().toUpperCase();
  const mod = String(moduleName || '').trim().toUpperCase();

  // Extract leading letters (or prefix before numbers/variant suffix)
  let suggestedPrefix = prod.replace(/[0-9]+.*$/, '');
  if (!suggestedPrefix || suggestedPrefix.length < 2) {
    suggestedPrefix = prod.slice(0, Math.min(4, prod.length));
  }
  // If ends with X or XL on a bank code like TBJAGOX -> TBJAGO
  if (suggestedPrefix.startsWith('TB') && suggestedPrefix.length > 5 && suggestedPrefix.endsWith('X')) {
    suggestedPrefix = suggestedPrefix.slice(0, -1);
  }

  let suggestedCategoryId = 'cat_pulsa_data';
  let suggestedSubCategory = 'Umum';
  let suggestedMatchType = 'prefix';

  if (mod.includes('VOUCHER') || mod.includes('INJECT VC') || prod.startsWith('V')) {
    suggestedCategoryId = 'cat_voucher';
    suggestedSubCategory = resolveSmartSubCategory(prod, mod, 'cat_voucher', 'Voucher Fisik & Inject');
  } else if (prod.startsWith('TB') || prod.startsWith('FBANK') || prod.startsWith('BNK')) {
    suggestedCategoryId = 'cat_transfer_bank';
    suggestedSubCategory = resolveSmartSubCategory(prod, mod, 'cat_transfer_bank', 'Transfer Bank');
  } else if (
    prod.startsWith('DANA') ||
    prod.startsWith('GO') ||
    prod.startsWith('OVO') ||
    prod.startsWith('SHP') ||
    prod.startsWith('SHOPEE') ||
    prod.startsWith('LINKAJA') ||
    prod.startsWith('GRAB')
  ) {
    suggestedCategoryId = 'cat_ewallet';
    suggestedSubCategory = resolveSmartSubCategory(prod, mod, 'cat_ewallet', 'Saldo E-Wallet');
  } else if (
    prod.startsWith('PLN') ||
    prod.startsWith('TKN') ||
    prod.startsWith('PPLN') ||
    prod.startsWith('BPJS') ||
    prod.startsWith('PDAM') ||
    prod.startsWith('SPDY') ||
    mod.includes('PPOB')
  ) {
    suggestedCategoryId = 'cat_ppob';
    suggestedSubCategory = resolveSmartSubCategory(prod, mod, 'cat_ppob', 'Tagihan PPOB');
  } else if (prod.startsWith('MLBB') || prod.startsWith('FF') || prod.startsWith('PUBG') || mod.includes('GAME')) {
    suggestedCategoryId = 'cat_ewallet';
    suggestedSubCategory = 'Topup Game & Voucher Digital';
  } else {
    suggestedCategoryId = 'cat_pulsa_data';
    suggestedSubCategory = resolveSmartSubCategory(prod, mod, 'cat_pulsa_data', 'Pulsa & Paket Data');
  }

  return {
    suggestedPrefix,
    suggestedCategoryId,
    suggestedSubCategory,
    suggestedMatchType,
  };
}

function toNumber(val) {
  if (val === null || val === undefined || val === '' || val === '<null>') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTimestamp(raw) {
  if (!raw) return { date: null, hour: 0, iso: '' };

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const yyyy = raw.getUTCFullYear();
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    const hour = raw.getUTCHours();
    const hh = String(hour).padStart(2, '0');
    const min = String(raw.getUTCMinutes()).padStart(2, '0');
    const ss = String(raw.getUTCSeconds()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;
    return { date, hour, iso: `${date}T${hh}:${min}:${ss}` };
  }

  if (typeof raw === 'number') {
    // Excel serial date
    const utcDays = Math.floor(raw - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const fractionalDay = raw - Math.floor(raw) + 0.0000001;
    let totalSeconds = Math.floor(86400 * fractionalDay);
    const seconds = totalSeconds % 60;
    totalSeconds -= seconds;
    const hours = Math.floor(totalSeconds / (60 * 60));
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const yyyy = dateInfo.getUTCFullYear();
    const mm = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateInfo.getUTCDate()).padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const min = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;
    return { date, hour: hours, iso: `${date}T${hh}:${min}:${ss}` };
  }

  const str = String(raw).trim();
  // Format: 2026-11-02T09:50:36.610 or 2026-11-02 09:50:36
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
  if (isoMatch) {
    return {
      date: isoMatch[1],
      hour: parseInt(isoMatch[2], 10) || 0,
      iso: str,
    };
  }

  // Format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] || '00';
    return {
      date: `${yyyy}-${mm}-${dd}`,
      hour,
      iso: `${yyyy}-${mm}-${dd}T${String(hour).padStart(2, '0')}:${min}:00`,
    };
  }

  // Fallback YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return { date: str.slice(0, 10), hour: 0, iso: str };
  }

  return { date: null, hour: 0, iso: str };
}

function extractCellValue(val) {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object') {
    if (Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text || '').join('');
    }
    if (val.result !== undefined) {
      return extractCellValue(val.result);
    }
    if (val.text !== undefined) {
      return val.text;
    }
    if (val.error !== undefined) {
      return null;
    }
  }
  return val;
}

/**
 * Parses an Excel/CSV buffer using ExcelJS and returns normalized transaction rows grouped by YYYY-MM-DD
 */
export async function parseExcelBuffer(buffer, fileName = 'upload.xlsx') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  if (ext === '.xls') {
    throw new Error('Format .xls lama tidak didukung demi keamanan. Silakan simpan ulang file sebagai .xlsx atau .csv.');
  }

  const workbook = new ExcelJS.Workbook();
  if (ext === '.csv') {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(`File "${fileName}" tidak memiliki sheet yang valid.`);
  }

  const rawRows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const maxCol = Math.max(row.cellCount || 0, 14);
    const arr = [];
    for (let c = 1; c <= maxCol; c++) {
      arr.push(extractCellValue(row.getCell(c).value));
    }
    rawRows.push(arr);
  });

  if (!rawRows || rawRows.length < 2) {
    throw new Error(`File "${fileName}" kosong atau tidak memiliki baris data transaksi.`);
  }

  // Locate header row (usually row 0, or first row containing 'Produk' / 'Tgl. Entri')
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const rowStr = (rawRows[i] || []).map((c) => String(c || '').toLowerCase()).join(' | ');
    if (rowStr.includes('produk') && (rowStr.includes('entri') || rowStr.includes('tujuan') || rowStr.includes('status'))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = (rawRows[headerRowIdx] || []).map((h) => String(h || '').trim().toLowerCase());

  const findCol = (candidates, fallbackIdx) => {
    for (const cand of candidates) {
      const idx = headers.findIndex((h) => h === cand || h.includes(cand));
      if (idx !== -1) return idx;
    }
    return fallbackIdx;
  };

  const colMap = {
    tglEntri: findCol(['tgl. entri', 'tgl entri', 'tanggal entri', 'tanggal', 'waktu'], 0),
    produk: findCol(['produk', 'kode produk', 'kode'], 1),
    tujuan: findCol(['tujuan', 'no tujuan', 'nomor'], 2),
    pengirim: findCol(['pengirim', 'sender'], 3),
    reseller: findCol(['nama reseller', 'reseller', 'agen', 'member'], 4),
    modul: findCol(['modul', 'supplier', 'jalur'], 5),
    status: findCol(['status', 'ket'], 6),
    tglStatus: findCol(['tgl. status', 'tgl status'], 7),
    hrgBeli: findCol(['hrg. beli', 'hrg beli', 'harga beli', 'modal'], 8),
    hrgJual: findCol(['hrg. jual', 'hrg jual', 'harga jual', 'omset'], 9),
    komisi: findCol(['komisi', 'poin', 'rebate'], 10),
    laba: findCol(['laba', 'profit', 'margin', 'untung'], 11),
    saldoAkhir: findCol(['saldo akhir'], 12),
    saldoSupplier: findCol(['saldo supplier'], 13),
  };

  const byDate = {};
  let validRowCount = 0;

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const rawTgl = row[colMap.tglEntri];
    const rawProduk = row[colMap.produk];
    if (!rawTgl && !rawProduk) continue;

    const { date, hour, iso } = parseTimestamp(rawTgl);
    if (!date) continue;

    const produk = String(rawProduk || '').trim().toUpperCase();
    if (!produk) continue;

    const tujuan = row[colMap.tujuan] !== null && row[colMap.tujuan] !== undefined ? String(row[colMap.tujuan]).trim() : '';
    const pengirim = row[colMap.pengirim] && row[colMap.pengirim] !== '<null>' ? String(row[colMap.pengirim]).trim() : '';
    const reseller = row[colMap.reseller] && row[colMap.reseller] !== '<null>' ? String(row[colMap.reseller]).trim() : 'Tanpa Nama';
    const modul = row[colMap.modul] && row[colMap.modul] !== '<null>' ? String(row[colMap.modul]).trim() : 'Tanpa Modul';
    const status = row[colMap.status] ? String(row[colMap.status]).trim() : 'Sukses';
    const rawTglStatus = row[colMap.tglStatus];
    const tglStatus =
      rawTglStatus instanceof Date
        ? parseTimestamp(rawTglStatus).iso
        : rawTglStatus && rawTglStatus !== '<null>'
        ? String(rawTglStatus).trim()
        : '';

    const hrgBeli = toNumber(row[colMap.hrgBeli]);
    const hrgJual = toNumber(row[colMap.hrgJual]);
    const komisi = toNumber(row[colMap.komisi]);
    const laba = toNumber(row[colMap.laba]);

    if (!byDate[date]) {
      byDate[date] = [];
    }

    byDate[date].push({
      id: `${date}_${i}`,
      tglEntri: iso,
      date,
      hour,
      produk,
      tujuan,
      pengirim,
      reseller,
      modul,
      status,
      tglStatus,
      hrgBeli,
      hrgJual,
      komisi,
      laba,
    });
    validRowCount++;
  }

  if (validRowCount === 0) {
    throw new Error(`Tidak ditemukan baris transaksi yang valid pada file "${fileName}". Pastikan kolom 'Tgl. Entri' dan 'Produk' tersedia.`);
  }

  return {
    fileName,
    validRowCount,
    dates: Object.keys(byDate).sort(),
    byDate,
  };
}

/**
 * Scans transactions across dates to find any uncategorized products for the Uncategorized Interceptor & Wizard
 */
export function scanUncategorizedProducts(transactions, rules, categories) {
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const compiledRules = compileRules(rules);
  const uncategorizedMap = new Map();
  let totalUncategorizedTrx = 0;
  let totalUncategorizedOmset = 0;

  for (const tx of transactions) {
    const evalResult = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
    if (!evalResult.isCategorized) {
      totalUncategorizedTrx++;
      if (tx.status === 'Sukses') {
        totalUncategorizedOmset += tx.hrgJual;
      }
      const existing = uncategorizedMap.get(tx.produk);
      if (!existing) {
        const suggestion = suggestRuleForProduct(tx.produk, tx.modul);
        uncategorizedMap.set(tx.produk, {
          produk: tx.produk,
          sampleTujuan: tx.tujuan || '-',
          frequency: 1,
          suksesCount: tx.status === 'Sukses' ? 1 : 0,
          totalOmset: tx.status === 'Sukses' ? tx.hrgJual : 0,
          modul: tx.modul || 'Tanpa Modul',
          modules: new Set([tx.modul || 'Tanpa Modul']),
          dates: new Set([tx.date]),
          ...suggestion,
        });
      } else {
        existing.frequency++;
        if (tx.status === 'Sukses') {
          existing.suksesCount++;
          existing.totalOmset += tx.hrgJual;
        }
        if (tx.modul) existing.modules.add(tx.modul);
        if (tx.date) existing.dates.add(tx.date);
      }
    }
  }

  const items = Array.from(uncategorizedMap.values())
    .map((item) => ({
      ...item,
      modules: Array.from(item.modules),
      dates: Array.from(item.dates).sort(),
    }))
    .sort((a, b) => b.frequency - a.frequency || b.totalOmset - a.totalOmset);

  return {
    hasUncategorized: items.length > 0,
    uncategorizedProductCount: items.length,
    totalUncategorizedTrx,
    totalUncategorizedOmset,
    items,
  };
}

function calcDelta(valD1, valD2) {
  const diff = valD1 - valD2;
  let pct = 0;
  if (valD2 > 0) {
    pct = ((valD1 - valD2) / valD2) * 100;
  } else if (valD1 > 0) {
    pct = 100;
  }
  return {
    diff,
    pct: Number(pct.toFixed(2)),
    trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
}

/**
 * Classifies failure status into the 3 operational audit buckets from PRD 5.2.E
 */
function classifyFailureBucket(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('stok kosong') || s.includes('kosong') || s.includes('habis')) {
    return 'stok_kosong';
  }
  if (s.includes('tujuan salah') || s.includes('salah') || s.includes('tidak terdaftar')) {
    return 'tujuan_salah';
  }
  return 'gangguan_timeout';
}

/**
 * Computes full Day-over-Day (DoD) or Period-over-Period comparison analytics
 */
export function computeComparisonAnalytics({
  d1Transactions,
  d2Transactions,
  d1Label,
  d2Label,
  d1Dates,
  d2Dates,
  categories,
  rules,
  globalUncategorizedReport,
}) {
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const compiledRules = compileRules(rules);

  // Helper to aggregate a single period
  const aggregatePeriod = (txList) => {
    let omset = 0;
    let hrgBeli = 0;
    let laba = 0;
    let labaPlc = 0;
    let labaKbb = 0;
    let labaAgen = 0;
    let komisi = 0;
    let komisiPlc = 0;
    let komisiKbb = 0;
    let komisiAgen = 0;
    let totalTrx = txList.length;
    let suksesTrx = 0;
    let gagalTrx = 0;

    const byCategory = new Map();
    const byProduct = new Map();
    const byReseller = new Map();
    const byModule = new Map();
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      trx: 0,
      suksesTrx: 0,
      omset: 0,
      laba: 0,
    }));

    const failures = {
      total: 0,
      stok_kosong: 0,
      tujuan_salah: 0,
      gangguan_timeout: 0,
      byStatus: {},
      records: [],
      byProduct: new Map(),
      byModule: new Map(),
    };

    // Initialize categories
    for (const cat of categories) {
      byCategory.set(cat.id, {
        categoryId: cat.id,
        name: cat.name,
        shortName: cat.shortName || cat.name,
        color: cat.color || '#6366f1',
        icon: cat.icon || 'Folder',
        order: cat.order || 99,
        omset: 0,
        trx: 0,
        laba: 0,
        komisi: 0,
        subCategories: new Map(),
      });
    }

    for (const tx of txList) {
      const evalRes = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
      const catId = evalRes.categoryId;

      if (!byCategory.has(catId)) {
        byCategory.set(catId, {
          categoryId: 'uncategorized',
          name: '[Belum Dikategorikan]',
          shortName: '[Belum Dikategorikan]',
          color: '#eab308',
          icon: 'AlertTriangle',
          order: 999,
          omset: 0,
          trx: 0,
          laba: 0,
          komisi: 0,
          subCategories: new Map(),
        });
      }

      const h = tx.hour >= 0 && tx.hour < 24 ? tx.hour : 0;
      hourly[h].trx++;

      if (tx.status === 'Sukses') {
        suksesTrx++;
        omset += tx.hrgJual;
        hrgBeli += tx.hrgBeli;
        laba += tx.laba;
        komisi += tx.komisi;

        hourly[h].suksesTrx++;
        hourly[h].omset += tx.hrgJual;
        hourly[h].laba += tx.laba;

        // Category & Sub-category aggregation
        const catEntry = byCategory.get(catId);
        catEntry.omset += tx.hrgJual;
        catEntry.trx++;
        catEntry.laba += tx.laba;
        catEntry.komisi += tx.komisi;

        const subName = evalRes.subCategory || 'Lainnya';
        if (!catEntry.subCategories.has(subName)) {
          catEntry.subCategories.set(subName, {
            name: subName,
            omset: 0,
            trx: 0,
            laba: 0,
            komisi: 0,
            products: new Map(),
          });
        }
        const subEntry = catEntry.subCategories.get(subName);
        subEntry.omset += tx.hrgJual;
        subEntry.trx++;
        subEntry.laba += tx.laba;
        subEntry.komisi += tx.komisi;

        if (!subEntry.products.has(tx.produk)) {
          subEntry.products.set(tx.produk, {
            produk: tx.produk,
            omset: 0,
            trx: 0,
            laba: 0,
            komisi: 0,
          });
        }
        const prodInSub = subEntry.products.get(tx.produk);
        prodInSub.omset += tx.hrgJual;
        prodInSub.trx++;
        prodInSub.laba += tx.laba;
        prodInSub.komisi += tx.komisi;

        // Product aggregation
        if (!byProduct.has(tx.produk)) {
          byProduct.set(tx.produk, {
            produk: tx.produk,
            categoryId: catId,
            categoryName: evalRes.categoryName,
            subCategory: subName,
            modul: tx.modul,
            omset: 0,
            trx: 0,
            laba: 0,
            komisi: 0,
          });
        }
        const pEntry = byProduct.get(tx.produk);
        pEntry.omset += tx.hrgJual;
        pEntry.trx++;
        pEntry.laba += tx.laba;
        pEntry.komisi += tx.komisi;

        // Reseller / Outlet aggregation (with per-outlet category, product, and hourly breakdown)
        const resKey = (tx.reseller || 'Tanpa Nama').trim();
        const outletEval = evaluateOutlet(resKey, tx.pengirim);
        if (!byReseller.has(resKey)) {
          byReseller.set(resKey, {
            reseller: resKey,
            outletCode: outletEval.outletCode,
            groupId: outletEval.groupId,
            groupName: outletEval.groupName,
            groupShortName: outletEval.groupShortName,
            groupColor: outletEval.groupColor,
            subCluster: outletEval.subCluster,
            isOfficialOutlet: outletEval.isOfficialOutlet,
            omset: 0,
            trx: 0,
            gagalTrx: 0,
            laba: 0,
            komisi: 0,
            byCategory: new Map(),
            byProduct: new Map(),
            customerCounts: new Map(),
            customerDetails: new Map(),
            hourly: Array.from({ length: 24 }, (_, hr) => ({
              hour: hr,
              label: `${String(hr).padStart(2, '0')}:00`,
              trx: 0,
              omset: 0,
            })),
          });
        }
        const rEntry = byReseller.get(resKey);
        if (rEntry.outletCode === '-' && outletEval.outletCode !== '-') {
          rEntry.outletCode = outletEval.outletCode;
        }
        rEntry.omset += tx.hrgJual;
        rEntry.trx++;
        rEntry.laba += tx.laba;
        rEntry.komisi += tx.komisi;
        if (outletEval.groupId === 'out_plc') {
          komisiPlc += tx.komisi;
          labaPlc += tx.laba;
        } else if (outletEval.groupId === 'out_kbb') {
          komisiKbb += tx.komisi;
          labaKbb += tx.laba;
        } else {
          komisiAgen += tx.komisi;
          labaAgen += tx.laba;
        }
        rEntry.hourly[h].trx++;
        rEntry.hourly[h].omset += tx.hrgJual;
        const custKey = String(tx.tujuan || '').trim();
        if (custKey && custKey !== '-' && custKey !== '<null>') {
          rEntry.customerCounts.set(custKey, (rEntry.customerCounts.get(custKey) || 0) + 1);
          if (!rEntry.customerDetails.has(custKey)) {
            rEntry.customerDetails.set(custKey, {
              tujuan: custKey,
              trx: 0,
              omset: 0,
              products: new Map(),
              hours: new Map(),
            });
          }
          const cDet = rEntry.customerDetails.get(custKey);
          cDet.trx++;
          cDet.omset += tx.hrgJual;
          cDet.products.set(tx.produk, (cDet.products.get(tx.produk) || 0) + 1);
          cDet.hours.set(h, (cDet.hours.get(h) || 0) + 1);
        }

        // Per-outlet category breakdown
        if (!rEntry.byCategory.has(catId)) {
          rEntry.byCategory.set(catId, {
            categoryId: catId,
            categoryName: evalRes.categoryName,
            omset: 0,
            trx: 0,
            laba: 0,
            komisi: 0,
          });
        }
        const outCat = rEntry.byCategory.get(catId);
        outCat.omset += tx.hrgJual;
        outCat.trx++;
        outCat.laba += tx.laba;
        outCat.komisi += tx.komisi;

        // Per-outlet product breakdown
        if (!rEntry.byProduct.has(tx.produk)) {
          rEntry.byProduct.set(tx.produk, {
            produk: tx.produk,
            subCategory: subName,
            omset: 0,
            trx: 0,
            laba: 0,
          });
        }
        const outProd = rEntry.byProduct.get(tx.produk);
        outProd.omset += tx.hrgJual;
        outProd.trx++;
        outProd.laba += tx.laba;

        // Module aggregation
        const modKey = tx.modul || 'Tanpa Modul';
        if (!byModule.has(modKey)) {
          byModule.set(modKey, {
            modul: modKey,
            omset: 0,
            suksesTrx: 0,
            gagalTrx: 0,
            laba: 0,
          });
        }
        const mEntry = byModule.get(modKey);
        mEntry.omset += tx.hrgJual;
        mEntry.suksesTrx++;
        mEntry.laba += tx.laba;
      } else {
        gagalTrx++;
        const resKey = (tx.reseller || 'Tanpa Nama').trim();
        const outletEval = evaluateOutlet(resKey, tx.pengirim);
        if (!byReseller.has(resKey)) {
          byReseller.set(resKey, {
            reseller: resKey,
            outletCode: outletEval.outletCode,
            groupId: outletEval.groupId,
            groupName: outletEval.groupName,
            groupShortName: outletEval.groupShortName,
            groupColor: outletEval.groupColor,
            subCluster: outletEval.subCluster,
            isOfficialOutlet: outletEval.isOfficialOutlet,
            omset: 0,
            trx: 0,
            gagalTrx: 0,
            laba: 0,
            komisi: 0,
            byCategory: new Map(),
            byProduct: new Map(),
            customerCounts: new Map(),
            customerDetails: new Map(),
            hourly: Array.from({ length: 24 }, (_, hr) => ({
              hour: hr,
              label: `${String(hr).padStart(2, '0')}:00`,
              trx: 0,
              omset: 0,
            })),
          });
        }
        byReseller.get(resKey).gagalTrx++;
        failures.total++;
        const bucket = classifyFailureBucket(tx.status);
        failures[bucket]++;
        failures.byStatus[tx.status] = (failures.byStatus[tx.status] || 0) + 1;
        failures.records.push({
          id: tx.id,
          tglEntri: tx.tglEntri,
          date: tx.date,
          produk: tx.produk,
          tujuan: tx.tujuan,
          reseller: tx.reseller,
          modul: tx.modul,
          status: tx.status,
          bucket,
          hrgJual: tx.hrgJual,
          categoryName: evalRes.categoryName,
        });

        const fp = failures.byProduct.get(tx.produk) || { produk: tx.produk, count: 0, modul: tx.modul, statuses: {} };
        fp.count++;
        fp.statuses[tx.status] = (fp.statuses[tx.status] || 0) + 1;
        failures.byProduct.set(tx.produk, fp);

        const modKey = tx.modul || 'Tanpa Modul';
        if (!byModule.has(modKey)) {
          byModule.set(modKey, {
            modul: modKey,
            omset: 0,
            suksesTrx: 0,
            gagalTrx: 0,
            laba: 0,
          });
        }
        byModule.get(modKey).gagalTrx++;
      }
    }

    const successRate = totalTrx > 0 ? Number(((suksesTrx / totalTrx) * 100).toFixed(2)) : 0;

    return {
      omset,
      hrgBeli,
      laba,
      labaPlc,
      labaKbb,
      labaAgen,
      komisi,
      komisiPlc,
      komisiKbb,
      komisiAgen,
      totalTrx,
      suksesTrx,
      gagalTrx,
      successRate,
      byCategory,
      byProduct,
      byReseller,
      byModule,
      hourly,
      failures,
    };
  };

  const aggD1 = aggregatePeriod(d1Transactions);
  const aggD2 = aggregatePeriod(d2Transactions);

  // 1. KPI Summary Cards
  const kpi = {
    omset: {
      d1: aggD1.omset,
      d2: aggD2.omset,
      ...calcDelta(aggD1.omset, aggD2.omset),
    },
    transaksiSukses: {
      d1: aggD1.suksesTrx,
      d2: aggD2.suksesTrx,
      totalD1: aggD1.totalTrx,
      totalD2: aggD2.totalTrx,
      gagalD1: aggD1.gagalTrx,
      gagalD2: aggD2.gagalTrx,
      successRateD1: aggD1.successRate,
      successRateD2: aggD2.successRate,
      successRateDiff: Number((aggD1.successRate - aggD2.successRate).toFixed(2)),
      ...calcDelta(aggD1.suksesTrx, aggD2.suksesTrx),
    },
    labaBersih: {
      d1: aggD1.laba,
      d2: aggD2.laba,
      ...calcDelta(aggD1.laba, aggD2.laba),
      breakdown: {
        plc: {
          d1: aggD1.labaPlc,
          d2: aggD2.labaPlc,
          sharePct: aggD1.laba !== 0 ? Number(((aggD1.labaPlc / aggD1.laba) * 100).toFixed(1)) : 0,
          ...calcDelta(aggD1.labaPlc, aggD2.labaPlc),
        },
        kbb: {
          d1: aggD1.labaKbb,
          d2: aggD2.labaKbb,
          sharePct: aggD1.laba !== 0 ? Number(((aggD1.labaKbb / aggD1.laba) * 100).toFixed(1)) : 0,
          ...calcDelta(aggD1.labaKbb, aggD2.labaKbb),
        },
        agen: {
          d1: aggD1.labaAgen,
          d2: aggD2.labaAgen,
          sharePct: aggD1.laba !== 0 ? Number(((aggD1.labaAgen / aggD1.laba) * 100).toFixed(1)) : 0,
          ...calcDelta(aggD1.labaAgen, aggD2.labaAgen),
        },
      },
    },
    komisiReseller: {
      d1: aggD1.komisi,
      d2: aggD2.komisi,
      ...calcDelta(aggD1.komisi, aggD2.komisi),
      breakdown: {
        plc: {
          d1: aggD1.komisiPlc,
          d2: aggD2.komisiPlc,
          sharePct: aggD1.komisi > 0 ? Number(((aggD1.komisiPlc / aggD1.komisi) * 100).toFixed(1)) : 0,
          ...calcDelta(aggD1.komisiPlc, aggD2.komisiPlc),
        },
        kbb: {
          d1: aggD1.komisiKbb,
          d2: aggD2.komisiKbb,
          sharePct: aggD1.komisi > 0 ? Number(((aggD1.komisiKbb / aggD1.komisi) * 100).toFixed(1)) : 0,
          ...calcDelta(aggD1.komisiKbb, aggD2.komisiKbb),
        },
        agen: {
          d1: aggD1.komisiAgen,
          d2: aggD2.komisiAgen,
          sharePct: aggD1.komisi > 0 ? Number(((aggD1.komisiAgen / aggD1.komisi) * 100).toFixed(1)) : 0,
          ...calcDelta(aggD1.komisiAgen, aggD2.komisiAgen),
        },
      },
    },
  };

  // 2. Side-by-Side Category Comparison with Sub-Category & Product Drill-Down
  const allCatIds = new Set([...aggD1.byCategory.keys(), ...aggD2.byCategory.keys()]);
  const categoryComparison = [];

  for (const catId of allCatIds) {
    const c1 = aggD1.byCategory.get(catId) || {
      categoryId: catId,
      name: '[Belum Dikategorikan]',
      shortName: '[Belum Dikategorikan]',
      color: '#eab308',
      icon: 'AlertTriangle',
      order: 999,
      omset: 0,
      trx: 0,
      laba: 0,
      komisi: 0,
      subCategories: new Map(),
    };
    const c2 = aggD2.byCategory.get(catId) || {
      omset: 0,
      trx: 0,
      laba: 0,
      komisi: 0,
      subCategories: new Map(),
    };

    // Skip uncategorized row if both D1 and D2 have 0 trx
    if (catId === 'uncategorized' && c1.trx === 0 && c2.trx === 0) continue;

    const omsetDelta = calcDelta(c1.omset, c2.omset);
    const trxDelta = calcDelta(c1.trx, c2.trx);
    const labaDelta = calcDelta(c1.laba, c2.laba);

    // Merge sub-categories
    const allSubNames = new Set([...c1.subCategories.keys(), ...c2.subCategories.keys()]);
    const subCategoriesList = [];

    for (const subName of allSubNames) {
      const s1 = c1.subCategories.get(subName) || { omset: 0, trx: 0, laba: 0, komisi: 0, products: new Map() };
      const s2 = c2.subCategories.get(subName) || { omset: 0, trx: 0, laba: 0, komisi: 0, products: new Map() };
      const subOmsetDelta = calcDelta(s1.omset, s2.omset);
      const subTrxDelta = calcDelta(s1.trx, s2.trx);

      // Merge products inside sub-category
      const allProdCodes = new Set([...s1.products.keys(), ...s2.products.keys()]);
      const productsList = [];
      for (const pCode of allProdCodes) {
        const p1 = s1.products.get(pCode) || { omset: 0, trx: 0, laba: 0, komisi: 0 };
        const p2 = s2.products.get(pCode) || { omset: 0, trx: 0, laba: 0, komisi: 0 };
        const pOmsetDelta = calcDelta(p1.omset, p2.omset);
        productsList.push({
          produk: pCode,
          omsetD1: p1.omset,
          omsetD2: p2.omset,
          selisihRp: pOmsetDelta.diff,
          selisihPct: pOmsetDelta.pct,
          trend: pOmsetDelta.trend,
          trxD1: p1.trx,
          trxD2: p2.trx,
          labaD1: p1.laba,
          labaD2: p2.laba,
        });
      }
      productsList.sort((a, b) => b.omsetD1 - a.omsetD1 || b.omsetD2 - a.omsetD2);

      subCategoriesList.push({
        name: subName,
        omsetD1: s1.omset,
        omsetD2: s2.omset,
        selisihRp: subOmsetDelta.diff,
        selisihPct: subOmsetDelta.pct,
        trend: subOmsetDelta.trend,
        trxD1: s1.trx,
        trxD2: s2.trx,
        trxDiff: subTrxDelta.diff,
        trxPct: subTrxDelta.pct,
        labaD1: s1.laba,
        labaD2: s2.laba,
        komisiD1: s1.komisi,
        komisiD2: s2.komisi,
        shareOfCatPct: c1.omset > 0 ? Number(((s1.omset / c1.omset) * 100).toFixed(2)) : 0,
        products: productsList,
      });
    }

    subCategoriesList.sort((a, b) => b.omsetD1 - a.omsetD1 || b.omsetD2 - a.omsetD2);

    categoryComparison.push({
      categoryId: c1.categoryId,
      name: c1.name,
      shortName: c1.shortName,
      color: c1.color,
      icon: c1.icon,
      order: c1.order,
      omsetD1: c1.omset,
      omsetD2: c2.omset,
      selisihRp: omsetDelta.diff,
      selisihPct: omsetDelta.pct,
      trend: omsetDelta.trend,
      trxD1: c1.trx,
      trxD2: c2.trx,
      trxDiff: trxDelta.diff,
      trxPct: trxDelta.pct,
      labaD1: c1.laba,
      labaD2: c2.laba,
      labaDiff: labaDelta.diff,
      komisiD1: c1.komisi,
      komisiD2: c2.komisi,
      shareD1Pct: aggD1.omset > 0 ? Number(((c1.omset / aggD1.omset) * 100).toFixed(2)) : 0,
      shareD2Pct: aggD2.omset > 0 ? Number(((c2.omset / aggD2.omset) * 100).toFixed(2)) : 0,
      subCategories: subCategoriesList,
    });
  }

  categoryComparison.sort((a, b) => a.order - b.order);

  // 3. Hourly Distribution Comparison (00:00 - 23:00)
  const hourlyComparison = Array.from({ length: 24 }, (_, h) => {
    const h1 = aggD1.hourly[h];
    const h2 = aggD2.hourly[h];
    return {
      hour: h,
      label: h1.label,
      trxD1: h1.trx,
      trxD2: h2.trx,
      suksesTrxD1: h1.suksesTrx,
      suksesTrxD2: h2.suksesTrx,
      omsetD1: h1.omset,
      omsetD2: h2.omset,
      labaD1: h1.laba,
      labaD2: h2.laba,
    };
  });

  const peakHourByTrxD1 = [...hourlyComparison].sort((a, b) => b.trxD1 - a.trxD1)[0] || hourlyComparison[0];
  const peakHourByOmsetD1 = [...hourlyComparison].sort((a, b) => b.omsetD1 - a.omsetD1)[0] || hourlyComparison[0];
  const peakHourByTrxD2 = [...hourlyComparison].sort((a, b) => b.trxD2 - a.trxD2)[0] || hourlyComparison[0];

  // 4. Growth Analysis: Top Gainers & Losers (Products & Resellers)
  const allProductCodes = new Set([...aggD1.byProduct.keys(), ...aggD2.byProduct.keys()]);
  const productMovers = [];

  for (const code of allProductCodes) {
    const p1 = aggD1.byProduct.get(code) || { omset: 0, trx: 0, laba: 0, komisi: 0 };
    const p2 = aggD2.byProduct.get(code) || { omset: 0, trx: 0, laba: 0, komisi: 0 };
    const meta = aggD1.byProduct.get(code) || aggD2.byProduct.get(code);
    const omsetDelta = calcDelta(p1.omset, p2.omset);
    const trxDelta = calcDelta(p1.trx, p2.trx);

    productMovers.push({
      produk: code,
      categoryName: meta.categoryName,
      subCategory: meta.subCategory,
      modul: meta.modul,
      omsetD1: p1.omset,
      omsetD2: p2.omset,
      selisihRp: omsetDelta.diff,
      selisihPct: omsetDelta.pct,
      trend: omsetDelta.trend,
      trxD1: p1.trx,
      trxD2: p2.trx,
      trxDiff: trxDelta.diff,
      trxPct: trxDelta.pct,
      labaD1: p1.laba,
      labaD2: p2.laba,
    });
  }

  const topProductGainers = [...productMovers]
    .filter((p) => p.selisihRp > 0)
    .sort((a, b) => b.selisihRp - a.selisihRp)
    .slice(0, 10);

  const topProductLosers = [...productMovers]
    .filter((p) => p.selisihRp < 0)
    .sort((a, b) => a.selisihRp - b.selisihRp)
    .slice(0, 10);

  const topProductsByOmsetD1 = [...productMovers]
    .sort((a, b) => b.omsetD1 - a.omsetD1)
    .slice(0, 15);

  const allResellerNames = new Set([...aggD1.byReseller.keys(), ...aggD2.byReseller.keys()]);
  const resellerMovers = [];
  const outletGroupsMap = new Map(
    DEFAULT_OUTLET_GROUPS.map((g) => [
      g.id,
      {
        ...g,
        omsetD1: 0,
        omsetD2: 0,
        trxD1: 0,
        trxD2: 0,
        gagalD1: 0,
        gagalD2: 0,
        labaD1: 0,
        labaD2: 0,
        komisiD1: 0,
        komisiD2: 0,
        activeOutletsD1: 0,
        activeOutletsD2: 0,
        outlets: [],
      },
    ])
  );

  for (const rName of allResellerNames) {
    const r1 = aggD1.byReseller.get(rName);
    const r2 = aggD2.byReseller.get(rName);
    const meta = r1 || r2 || evaluateOutlet(rName, '');

    const omsetD1 = r1?.omset || 0;
    const omsetD2 = r2?.omset || 0;
    const trxD1 = r1?.trx || 0;
    const trxD2 = r2?.trx || 0;
    const gagalD1 = r1?.gagalTrx || 0;
    const gagalD2 = r2?.gagalTrx || 0;
    const labaD1 = r1?.laba || 0;
    const labaD2 = r2?.laba || 0;
    const komisiD1 = r1?.komisi || 0;
    const komisiD2 = r2?.komisi || 0;

    const omsetDelta = calcDelta(omsetD1, omsetD2);
    const trxDelta = calcDelta(trxD1, trxD2);
    const labaDelta = calcDelta(labaD1, labaD2);
    const totalTrxOutletD1 = trxD1 + gagalD1;
    const successRateD1 =
      totalTrxOutletD1 > 0 ? Number(((trxD1 / totalTrxOutletD1) * 100).toFixed(1)) : 100;

    // Build per-outlet category breakdown (D1 vs D2)
    const outletCatBreakdown = [];
    for (const cat of categories) {
      const oc1 = r1?.byCategory?.get(cat.id) || { omset: 0, trx: 0, laba: 0, komisi: 0 };
      const oc2 = r2?.byCategory?.get(cat.id) || { omset: 0, trx: 0, laba: 0, komisi: 0 };
      if (oc1.trx === 0 && oc2.trx === 0) continue;
      const ocDelta = calcDelta(oc1.omset, oc2.omset);
      outletCatBreakdown.push({
        categoryId: cat.id,
        name: cat.name,
        shortName: cat.shortName || cat.name,
        color: cat.color || '#6366f1',
        omsetD1: oc1.omset,
        omsetD2: oc2.omset,
        selisihRp: ocDelta.diff,
        selisihPct: ocDelta.pct,
        trend: ocDelta.trend,
        trxD1: oc1.trx,
        trxD2: oc2.trx,
        labaD1: oc1.laba,
        komisiD1: oc1.komisi,
        sharePct: omsetD1 > 0 ? Number(((oc1.omset / omsetD1) * 100).toFixed(1)) : 0,
      });
    }
    outletCatBreakdown.sort((a, b) => b.omsetD1 - a.omsetD1 || b.omsetD2 - a.omsetD2);

    // Build per-outlet top products
    const allOutProdCodes = new Set([
      ...(r1?.byProduct ? r1.byProduct.keys() : []),
      ...(r2?.byProduct ? r2.byProduct.keys() : []),
    ]);
    const outletTopProducts = [];
    for (const pCode of allOutProdCodes) {
      const op1 = r1?.byProduct?.get(pCode) || { omset: 0, trx: 0, laba: 0, subCategory: 'Umum' };
      const op2 = r2?.byProduct?.get(pCode) || { omset: 0, trx: 0, laba: 0, subCategory: 'Umum' };
      const opDelta = calcDelta(op1.omset, op2.omset);
      outletTopProducts.push({
        produk: pCode,
        subCategory: op1.subCategory || op2.subCategory || 'Umum',
        omsetD1: op1.omset,
        omsetD2: op2.omset,
        selisihRp: opDelta.diff,
        selisihPct: opDelta.pct,
        trxD1: op1.trx,
        trxD2: op2.trx,
        labaD1: op1.laba,
      });
    }
    outletTopProducts.sort((a, b) => b.omsetD1 - a.omsetD1 || b.trxD1 - a.trxD1);

    // Build per-outlet hourly comparison & peak hour
    const outletHourly = Array.from({ length: 24 }, (_, hr) => ({
      hour: hr,
      label: `${String(hr).padStart(2, '0')}:00`,
      trxD1: r1?.hourly?.[hr]?.trx || 0,
      trxD2: r2?.hourly?.[hr]?.trx || 0,
      omsetD1: r1?.hourly?.[hr]?.omset || 0,
      omsetD2: r2?.hourly?.[hr]?.omset || 0,
    }));
    const peakHourObj = [...outletHourly].sort((a, b) => b.trxD1 - a.trxD1 || b.omsetD1 - a.omsetD1)[0];

    // Customer habit aggregation for D1
    const custMapD1 = r1?.customerCounts;
    let uniqueCustomersD1 = 0;
    let repeatCustomersD1 = 0;
    if (custMapD1 && custMapD1.size > 0) {
      uniqueCustomersD1 = custMapD1.size;
      for (const cnt of custMapD1.values()) {
        if (cnt >= 2) repeatCustomersD1++;
      }
    }
    const repeatRateD1 = uniqueCustomersD1 > 0
      ? Number(((repeatCustomersD1 / uniqueCustomersD1) * 100).toFixed(1))
      : 0;
    const avgTicketSizeD1 = trxD1 > 0 ? Math.round(omsetD1 / trxD1) : 0;

    // Top frequent customers at this outlet on D1
    const topCustomersD1 = [];
    if (r1?.customerDetails && r1.customerDetails.size > 0) {
      const sortedCusts = Array.from(r1.customerDetails.values())
        .sort((a, b) => b.trx - a.trx || b.omset - a.omset)
        .slice(0, 8);
      for (const cd of sortedCusts) {
        let topProduct = '-';
        let topProdCnt = 0;
        for (const [pName, pCnt] of cd.products.entries()) {
          if (pCnt > topProdCnt) {
            topProdCnt = pCnt;
            topProduct = pName;
          }
        }
        let peakHr = 0;
        let peakHrCnt = -1;
        for (const [hr, hrCnt] of cd.hours.entries()) {
          if (hrCnt > peakHrCnt) {
            peakHrCnt = hrCnt;
            peakHr = hr;
          }
        }
        topCustomersD1.push({
          tujuan: cd.tujuan,
          trx: cd.trx,
          omset: cd.omset,
          avgTicketSize: cd.trx > 0 ? Math.round(cd.omset / cd.trx) : 0,
          topProduct,
          peakHour: `${String(peakHr).padStart(2, '0')}:00`,
        });
      }
    }

    // Dominant time-of-day habit slot
    const slots = [
      { label: 'Dini Hari (00-05)', from: 0, to: 5 },
      { label: 'Pagi (06-11)', from: 6, to: 11 },
      { label: 'Siang (12-16)', from: 12, to: 16 },
      { label: 'Sore & Malam (17-23)', from: 17, to: 23 },
    ];
    let dominantTimeSlotD1 = '-';
    let bestSlotTrx = 0;
    for (const s of slots) {
      let sum = 0;
      for (let hr = s.from; hr <= s.to; hr++) {
        sum += outletHourly[hr]?.trxD1 || 0;
      }
      if (sum > bestSlotTrx) {
        bestSlotTrx = sum;
        dominantTimeSlotD1 = s.label;
      }
    }

    const outletItem = {
      reseller: rName,
      outletName: rName,
      outletCode: r1?.outletCode !== '-' ? r1?.outletCode : r2?.outletCode || '-',
      groupId: meta.groupId,
      groupName: meta.groupName,
      groupShortName: meta.groupShortName,
      groupColor: meta.groupColor,
      subCluster: meta.subCluster || '-',
      isOfficialOutlet: !!meta.isOfficialOutlet,
      omsetD1,
      omsetD2,
      selisihRp: omsetDelta.diff,
      selisihPct: omsetDelta.pct,
      trend: omsetDelta.trend,
      trxD1,
      trxD2,
      trxDiff: trxDelta.diff,
      trxPct: trxDelta.pct,
      gagalD1,
      gagalD2,
      successRateD1,
      labaD1,
      labaD2,
      labaDiff: labaDelta.diff,
      komisiD1,
      komisiD2,
      shareServerPct: aggD1.omset > 0 ? Number(((omsetD1 / aggD1.omset) * 100).toFixed(2)) : 0,
      peakHour: peakHourObj?.trxD1 > 0 ? `${peakHourObj.label} (${peakHourObj.trxD1} Trx)` : '-',
      customerHabit: {
        uniqueCustomersD1,
        repeatCustomersD1,
        repeatRateD1,
        avgTicketSizeD1,
        dominantTimeSlotD1,
        topCategoryD1: outletCatBreakdown[0]?.trxD1 > 0 ? outletCatBreakdown[0].name : '-',
        topCustomersD1,
      },
      categoryBreakdown: outletCatBreakdown,
      topProducts: outletTopProducts.slice(0, 12),
      hourlyComparison: outletHourly,
    };

    resellerMovers.push(outletItem);

    const grp = outletGroupsMap.get(meta.groupId);
    if (grp) {
      grp.omsetD1 += omsetD1;
      grp.omsetD2 += omsetD2;
      grp.trxD1 += trxD1;
      grp.trxD2 += trxD2;
      grp.gagalD1 += gagalD1;
      grp.gagalD2 += gagalD2;
      grp.labaD1 += labaD1;
      grp.labaD2 += labaD2;
      grp.komisiD1 += komisiD1;
      grp.komisiD2 += komisiD2;
      if (trxD1 > 0) grp.activeOutletsD1++;
      if (trxD2 > 0) grp.activeOutletsD2++;
      grp.outlets.push(outletItem);
    }
  }

  // Finalize Outlet Group Comparison
  const outletGroupComparison = [];
  for (const grp of outletGroupsMap.values()) {
    if (grp.outlets.length === 0) continue;
    grp.outlets.sort((a, b) => b.omsetD1 - a.omsetD1 || b.omsetD2 - a.omsetD2);
    const omsetDelta = calcDelta(grp.omsetD1, grp.omsetD2);
    const trxDelta = calcDelta(grp.trxD1, grp.trxD2);
    const labaDelta = calcDelta(grp.labaD1, grp.labaD2);

    outletGroupComparison.push({
      groupId: grp.id,
      name: grp.name,
      shortName: grp.shortName,
      type: grp.type,
      color: grp.color,
      description: grp.description,
      order: grp.order,
      outletCount: grp.outlets.length,
      activeOutletsD1: grp.activeOutletsD1,
      activeOutletsD2: grp.activeOutletsD2,
      omsetD1: grp.omsetD1,
      omsetD2: grp.omsetD2,
      selisihRp: omsetDelta.diff,
      selisihPct: omsetDelta.pct,
      trend: omsetDelta.trend,
      trxD1: grp.trxD1,
      trxD2: grp.trxD2,
      trxDiff: trxDelta.diff,
      trxPct: trxDelta.pct,
      gagalD1: grp.gagalD1,
      gagalD2: grp.gagalD2,
      labaD1: grp.labaD1,
      labaD2: grp.labaD2,
      labaDiff: labaDelta.diff,
      komisiD1: grp.komisiD1,
      komisiD2: grp.komisiD2,
      shareD1Pct: aggD1.omset > 0 ? Number(((grp.omsetD1 / aggD1.omset) * 100).toFixed(2)) : 0,
      shareD2Pct: aggD2.omset > 0 ? Number(((grp.omsetD2 / aggD2.omset) * 100).toFixed(2)) : 0,
      avgOmsetPerOutletD1:
        grp.activeOutletsD1 > 0 ? Math.round(grp.omsetD1 / grp.activeOutletsD1) : 0,
      outlets: grp.outlets,
    });
  }
  outletGroupComparison.sort((a, b) => a.order - b.order);

  const allOutletsSorted = [...resellerMovers]
    .filter((o) => o.isOfficialOutlet)
    .sort((a, b) => b.omsetD1 - a.omsetD1 || b.omsetD2 - a.omsetD2);
  const officialOutlets = allOutletsSorted;
  const plcOutlets = officialOutlets.filter((o) => o.groupId === 'out_plc');
  const kbbOutlets = officialOutlets.filter((o) => o.groupId === 'out_kbb');

  const officialOmsetD1 = officialOutlets.reduce((s, o) => s + o.omsetD1, 0);
  const officialOmsetD2 = officialOutlets.reduce((s, o) => s + o.omsetD2, 0);
  const officialTrxD1 = officialOutlets.reduce((s, o) => s + o.trxD1, 0);
  const officialTrxD2 = officialOutlets.reduce((s, o) => s + o.trxD2, 0);
  const activeOfficialD1 = officialOutlets.filter((o) => o.trxD1 > 0).length;
  const activeOfficialD2 = officialOutlets.filter((o) => o.trxD2 > 0).length;

  const plcGroup = outletGroupComparison.find((g) => g.groupId === 'out_plc') || null;
  const kbbGroup = outletGroupComparison.find((g) => g.groupId === 'out_kbb') || null;

  const outletAnalytics = {
    kpi: {
      officialOmset: {
        d1: officialOmsetD1,
        d2: officialOmsetD2,
        sharePct: aggD1.omset > 0 ? Number(((officialOmsetD1 / aggD1.omset) * 100).toFixed(2)) : 0,
        ...calcDelta(officialOmsetD1, officialOmsetD2),
      },
      officialTrx: {
        d1: officialTrxD1,
        d2: officialTrxD2,
        activeOutletsD1: activeOfficialD1,
        activeOutletsD2: activeOfficialD2,
        totalOutlets: officialOutlets.length,
        plcCount: plcOutlets.length,
        kbbCount: kbbOutlets.length,
        ...calcDelta(officialTrxD1, officialTrxD2),
      },
      avgPerOfficialOutlet: {
        d1: activeOfficialD1 > 0 ? Math.round(officialOmsetD1 / activeOfficialD1) : 0,
        d2: activeOfficialD2 > 0 ? Math.round(officialOmsetD2 / activeOfficialD2) : 0,
        ...calcDelta(
          activeOfficialD1 > 0 ? Math.round(officialOmsetD1 / activeOfficialD1) : 0,
          activeOfficialD2 > 0 ? Math.round(officialOmsetD2 / activeOfficialD2) : 0
        ),
      },
      plcSummary: plcGroup,
      kbbSummary: kbbGroup,
      topOutletD1: officialOutlets[0] || null,
      topPlcOutletD1: plcOutlets[0] || null,
      topKbbOutletD1: kbbOutlets[0] || null,
    },
    outletGroupComparison,
    allOutlets: officialOutlets,
    officialOutlets,
  };

  const topResellerGainers = [...resellerMovers]
    .filter((r) => r.selisihRp > 0)
    .sort((a, b) => b.selisihRp - a.selisihRp)
    .slice(0, 10);

  const topResellerLosers = [...resellerMovers]
    .filter((r) => r.selisihRp < 0)
    .sort((a, b) => a.selisihRp - b.selisihRp)
    .slice(0, 10);

  const topResellersByOmsetD1 = [...resellerMovers]
    .sort((a, b) => b.omsetD1 - a.omsetD1)
    .slice(0, 15);

  // Module performance comparison
  const allModules = new Set([...aggD1.byModule.keys(), ...aggD2.byModule.keys()]);
  const modulePerformance = [];
  for (const modName of allModules) {
    const m1 = aggD1.byModule.get(modName) || { omset: 0, suksesTrx: 0, gagalTrx: 0, laba: 0 };
    const m2 = aggD2.byModule.get(modName) || { omset: 0, suksesTrx: 0, gagalTrx: 0, laba: 0 };
    const total1 = m1.suksesTrx + m1.gagalTrx;
    modulePerformance.push({
      modul: modName,
      omsetD1: m1.omset,
      omsetD2: m2.omset,
      suksesTrxD1: m1.suksesTrx,
      gagalTrxD1: m1.gagalTrx,
      successRateD1: total1 > 0 ? Number(((m1.suksesTrx / total1) * 100).toFixed(2)) : 100,
      labaD1: m1.laba,
    });
  }
  modulePerformance.sort((a, b) => b.omsetD1 - a.omsetD1);

  // 5. Failure & Operational Audit
  const failureAudit = {
    summary: {
      totalD1: aggD1.failures.total,
      totalD2: aggD2.failures.total,
      ...calcDelta(aggD1.failures.total, aggD2.failures.total),
      buckets: [
        {
          id: 'stok_kosong',
          name: 'Stok Kosong',
          subtitle: 'Peringatan voucher / saldo produk habis di supplier',
          d1: aggD1.failures.stok_kosong,
          d2: aggD2.failures.stok_kosong,
          ...calcDelta(aggD1.failures.stok_kosong, aggD2.failures.stok_kosong),
        },
        {
          id: 'tujuan_salah',
          name: 'Tujuan Salah',
          subtitle: 'Kesalahan input nomor tujuan oleh agen / reseller',
          d1: aggD1.failures.tujuan_salah,
          d2: aggD2.failures.tujuan_salah,
          ...calcDelta(aggD1.failures.tujuan_salah, aggD2.failures.tujuan_salah),
        },
        {
          id: 'gangguan_timeout',
          name: 'Produk Gangguan / Timeout / Gagal',
          subtitle: 'Kendala teknis jalur supplier, timeout, atau dibatalkan',
          d1: aggD1.failures.gangguan_timeout,
          d2: aggD2.failures.gangguan_timeout,
          ...calcDelta(aggD1.failures.gangguan_timeout, aggD2.failures.gangguan_timeout),
        },
      ],
      byStatusD1: aggD1.failures.byStatus,
      byStatusD2: aggD2.failures.byStatus,
    },
    topFailedProductsD1: Array.from(aggD1.failures.byProduct.values()).sort((a, b) => b.count - a.count),
    recordsD1: aggD1.failures.records,
    recordsD2: aggD2.failures.records,
  };

  // Scan uncategorized specifically in D1 + D2
  const periodUncategorized = scanUncategorizedProducts(
    [...d1Transactions, ...d2Transactions],
    rules,
    categories
  );

  // 6. Generate WhatsApp Summary Text
  const whatsappText = generateWhatsAppSummary({
    d1Label,
    d2Label,
    kpi,
    categoryComparison,
    outletAnalytics,
    topProductGainers,
    topProductLosers,
    failureAudit,
    peakHourByTrxD1,
  });

  return {
    period: {
      d1Label,
      d2Label,
      d1Dates,
      d2Dates,
    },
    kpi,
    categoryComparison,
    outletAnalytics,
    hourlyComparison,
    peakHours: {
      byTrxD1: peakHourByTrxD1,
      byOmsetD1: peakHourByOmsetD1,
      byTrxD2: peakHourByTrxD2,
    },
    growth: {
      topProductGainers,
      topProductLosers,
      topProductsByOmsetD1,
      topResellerGainers,
      topResellerLosers,
      topResellersByOmsetD1,
      modulePerformance,
    },
    failureAudit,
    uncategorized: {
      period: periodUncategorized,
      global: globalUncategorizedReport,
    },
    whatsappText,
  };
}

function formatRp(num) {
  const abs = Math.abs(Math.round(num || 0));
  return 'Rp ' + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatNum(num) {
  return Math.round(num || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function generateWhatsAppSummary({
  d1Label,
  d2Label,
  kpi,
  categoryComparison,
  outletAnalytics,
  topProductGainers,
  topProductLosers,
  failureAudit,
  peakHourByTrxD1,
}) {
  const omsetSign = kpi.omset.diff >= 0 ? '+' : '-';
  const omsetPctSign = kpi.omset.pct >= 0 ? '+' : '';
  const omsetIcon = kpi.omset.diff >= 0 ? '🟢' : '🔴';

  const labaSign = kpi.labaBersih.diff >= 0 ? '+' : '-';
  const labaPctSign = kpi.labaBersih.pct >= 0 ? '+' : '';

  const lines = [
    `📊 *LAPORAN HARIAN SERVER PULSA & PPOB*`,
    `📅 *Periode*: ${d1Label} vs ${d2Label}`,
    ``,
    `*=== PERFORMA UTAMA (DoD) ===*`,
    `💰 Omset Penjualan: ${formatRp(kpi.omset.d1)} (${omsetIcon} ${omsetSign}${formatRp(Math.abs(kpi.omset.diff))} / ${omsetPctSign}${kpi.omset.pct}%)`,
    `📦 Trx Sukses: ${formatNum(kpi.transaksiSukses.d1)} Trx (${kpi.transaksiSukses.successRateD1}%)`,
    `💵 Laba Server: ${formatRp(kpi.labaBersih.d1)} (${labaSign}${formatRp(Math.abs(kpi.labaBersih.diff))} / ${labaPctSign}${kpi.labaBersih.pct}%) — PLC: ${formatRp(kpi.labaBersih?.breakdown?.plc?.d1 || 0)} | KBB: ${formatRp(kpi.labaBersih?.breakdown?.kbb?.d1 || 0)} | Agen: ${formatRp(kpi.labaBersih?.breakdown?.agen?.d1 || 0)}`,
    `👥 Komisi Reseller: ${formatRp(kpi.komisiReseller.d1)} (PLC: ${formatRp(kpi.komisiReseller?.breakdown?.plc?.d1 || 0)} | KBB: ${formatRp(kpi.komisiReseller?.breakdown?.kbb?.d1 || 0)} | Agen: ${formatRp(kpi.komisiReseller?.breakdown?.agen?.d1 || 0)})`,
    `⏰ Jam Puncak Trx: Pukul ${peakHourByTrxD1?.label || '-'} (${formatNum(peakHourByTrxD1?.trxD1 || 0)} Trx)`,
    ``,
    `*=== PERFORMA PER KATEGORI ===*`,
  ];

  for (const cat of categoryComparison) {
    const icon = cat.selisihRp >= 0 ? '🟢' : '🔴';
    const pctSign = cat.selisihPct >= 0 ? '+' : '';
    lines.push(
      `${icon} ${cat.shortName}: ${formatRp(cat.omsetD1)} (${pctSign}${cat.selisihPct}% | ${formatNum(cat.trxD1)} Trx)`
    );
  }

  if (outletAnalytics?.officialOutlets?.length > 0) {
    lines.push(``, `*=== TOP 5 OUTLET CABANG TERATAS ===*`);
    for (const o of outletAnalytics.officialOutlets.slice(0, 5)) {
      const pctSign = o.selisihPct >= 0 ? '+' : '';
      lines.push(
        `🏪 *${o.outletName}*: ${formatRp(o.omsetD1)} (${pctSign}${o.selisihPct}% | ${formatNum(o.trxD1)} Trx)`
      );
    }
  }

  if (topProductGainers.length > 0) {
    lines.push(``, `*=== TOP 3 PRODUK NAIK TERTINGGI ===*`);
    for (const p of topProductGainers.slice(0, 3)) {
      lines.push(`🚀 *${p.produk}*: ${formatRp(p.omsetD1)} (+${formatRp(p.selisihRp)} / +${p.selisihPct}%)`);
    }
  }

  if (topProductLosers.length > 0) {
    lines.push(``, `*=== TOP 3 PRODUK TURUN TERBESAR ===*`);
    for (const p of topProductLosers.slice(0, 3)) {
      lines.push(`🔻 *${p.produk}*: ${formatRp(p.omsetD1)} (-${formatRp(Math.abs(p.selisihRp))} / ${p.selisihPct}%)`);
    }
  }

  lines.push(
    ``,
    `*=== AUDIT KEGAGALAN OPERASIONAL ===*`,
    `⚠️ Total Trx Gagal: ${formatNum(failureAudit.summary.totalD1)} Trx`,
    `• Stok Kosong: ${failureAudit.summary.buckets[0].d1} Trx`,
    `• Tujuan Salah: ${failureAudit.summary.buckets[1].d1} Trx`,
    `• Gangguan / Timeout: ${failureAudit.summary.buckets[2].d1} Trx`,
    ``,
    `_Digenerate otomatis oleh AnalisaOto ZimaOS Private Edition_`
  );

  return lines.join('\n');
}

const INDO_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const HABIT_TIME_SLOTS = [
  { label: 'Dini Hari (00-05)', from: 0, to: 5 },
  { label: 'Pagi (06-11)', from: 6, to: 11 },
  { label: 'Siang (12-16)', from: 12, to: 16 },
  { label: 'Sore & Malam (17-23)', from: 17, to: 23 },
];

const HABIT_SEGMENT_LABELS = {
  vip_power: 'Pelanggan VIP / Power',
  rutin_harian: 'Rutin Lintas Hari',
  rutin_mingguan: 'Rutin Mingguan',
  repeat_harian: 'Repeat Harian',
  reguler: 'Pelanggan Reguler',
};

/**
 * Safely computes day-of-week index (0=Minggu..6=Sabtu) from YYYY-MM-DD without UTC offset drift.
 */
function getDayOfWeekFromDateStr(dateStr) {
  const parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return 0;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d).getDay();
}

/**
 * Infers human-readable customer target number type based on dominant category.
 */
function inferCustomerType(topCategoryId) {
  if (topCategoryId === 'cat_transfer_bank') return 'Rekening Bank';
  if (topCategoryId === 'cat_ewallet') return 'Nomor E-Wallet';
  if (topCategoryId === 'cat_ppob') return 'ID Pelanggan / PPOB';
  if (topCategoryId === 'cat_pulsa_data' || topCategoryId === 'cat_voucher') {
    return 'Nomor HP / Seluler';
  }
  return 'Nomor Tujuan';
}

/**
 * Classifies a customer's repeat frequency into an actionable habit segment.
 */
function classifyHabitSegment({ totalTrx, activeDays, totalDaysInPeriod, maxTrxInOneDay, totalOmset }) {
  if (
    totalTrx >= 5 ||
    (totalDaysInPeriod >= 3 && activeDays >= 3 && totalTrx >= 4) ||
    (totalOmset >= 10_000_000 && totalTrx >= 2)
  ) {
    return 'vip_power';
  }
  if (totalDaysInPeriod >= 2 && activeDays >= Math.max(2, Math.ceil(totalDaysInPeriod * 0.6))) {
    return 'rutin_harian';
  }
  if (totalDaysInPeriod >= 3 && activeDays >= 2) {
    return 'rutin_mingguan';
  }
  if (maxTrxInOneDay >= 2) {
    return 'repeat_harian';
  }
  return 'reguler';
}

/**
 * Finds the dominant time-of-day slot from a 24-hour count array.
 */
function resolveDominantTimeSlot(hourlyCounts) {
  let dominant = '-';
  let bestSum = 0;
  for (const slot of HABIT_TIME_SLOTS) {
    let sum = 0;
    for (let hr = slot.from; hr <= slot.to; hr++) {
      sum += hourlyCounts[hr] || 0;
    }
    if (sum > bestSum) {
      bestSum = sum;
      dominant = slot.label;
    }
  }
  return dominant;
}

/**
 * Checks whether an evaluated outlet matches the requested groupFilter and outletFilter.
 */
function matchesOutletScope(outletEval, groupFilter, outletFilter) {
  if (outletFilter && outletFilter !== 'ALL') {
    if (outletEval.outletName.toLowerCase() !== String(outletFilter).trim().toLowerCase()) {
      return false;
    }
  }
  if (groupFilter && groupFilter !== 'ALL') {
    if (groupFilter === 'OFFICIAL') {
      if (!outletEval.isOfficialOutlet) return false;
    } else if (outletEval.groupId !== groupFilter) {
      return false;
    }
  }
  return true;
}

/**
 * Finalizes a customer accumulator into a structured habit profile object.
 */
function finalizeCustomerHabitRecord(acc, { totalDaysInPeriod, globalOutletMap }) {
  const activeDates = Array.from(acc.dateCounts.keys()).sort();
  const activeDays = activeDates.length;
  let maxTrxInOneDay = 0;
  for (const cnt of acc.dateCounts.values()) {
    if (cnt > maxTrxInOneDay) maxTrxInOneDay = cnt;
  }

  let peakHourIdx = 0;
  let peakHourTrx = -1;
  const activeHours = [];
  for (let hr = 0; hr < 24; hr++) {
    const cnt = acc.hourlyCounts[hr] || 0;
    if (cnt > 0) activeHours.push(hr);
    if (cnt > peakHourTrx) {
      peakHourTrx = cnt;
      peakHourIdx = hr;
    }
  }
  const peakHour = acc.totalTrx > 0 ? `${String(peakHourIdx).padStart(2, '0')}:00` : '-';
  const dominantTimeSlot = resolveDominantTimeSlot(acc.hourlyCounts);

  let favDowIdx = 0;
  let favDowCnt = -1;
  for (let d = 0; d < 7; d++) {
    if (acc.dowCounts[d] > favDowCnt) {
      favDowCnt = acc.dowCounts[d];
      favDowIdx = d;
    }
  }
  const favoriteDayOfWeek = acc.totalTrx > 0 ? INDO_DAY_NAMES[favDowIdx] : '-';

  const outletsList = Array.from(acc.outlets.values())
    .sort((a, b) => b.trx - a.trx || b.omset - a.omset)
    .map((o) => ({
      ...o,
      sharePct: acc.totalTrx > 0 ? Number(((o.trx / acc.totalTrx) * 100).toFixed(1)) : 0,
    }));
  const primaryOutletObj = outletsList[0] || {
    outletName: '-',
    outletCode: '-',
    groupId: 'non_plc_kbb',
    groupShortName: '-',
    subCluster: '-',
    trx: 0,
  };

  const globalOutletsForNum = globalOutletMap?.get(acc.tujuan);
  const globalOutletCount = globalOutletsForNum ? globalOutletsForNum.size : outletsList.length;

  const categoriesList = Array.from(acc.categories.values()).sort(
    (a, b) => b.trx - a.trx || b.omset - a.omset
  );
  const topCatObj = categoriesList[0] || { categoryId: '', name: '-', shortName: '-' };

  const productsList = Array.from(acc.products.values()).sort(
    (a, b) => b.trx - a.trx || b.omset - a.omset
  );
  const topProdObj = productsList[0] || { produk: '-', subCategory: '-' };

  const avgTicketSize = acc.totalTrx > 0 ? Math.round(acc.totalOmset / acc.totalTrx) : 0;
  const avgTrxPerActiveDay = activeDays > 0 ? Number((acc.totalTrx / activeDays).toFixed(2)) : 0;
  const avgTrxPerPeriodDay =
    totalDaysInPeriod > 0 ? Number((acc.totalTrx / totalDaysInPeriod).toFixed(2)) : 0;
  const estimatedPerWeek =
    totalDaysInPeriod >= 7
      ? Number(((acc.totalTrx / totalDaysInPeriod) * 7).toFixed(1))
      : totalDaysInPeriod >= 2
      ? Number(((acc.totalTrx / totalDaysInPeriod) * 7).toFixed(1))
      : acc.totalTrx;

  const habitSegment = classifyHabitSegment({
    totalTrx: acc.totalTrx,
    activeDays,
    totalDaysInPeriod,
    maxTrxInOneDay,
    totalOmset: acc.totalOmset,
  });
  const habitLabel = HABIT_SEGMENT_LABELS[habitSegment] || 'Pelanggan Reguler';
  const customerType = inferCustomerType(topCatObj.categoryId);

  const loyaltyPct = primaryOutletObj.sharePct || 0;
  const outletCount = outletsList.length;
  const isMultiOutlet = globalOutletCount > 1 || outletCount > 1;

  const freqText =
    activeDays > 1
      ? `${acc.totalTrx}x dalam ${activeDays} hari`
      : `${acc.totalTrx}x transaksi`;
  const outletText =
    outletCount > 1
      ? `utama di ${primaryOutletObj.outletName} (${loyaltyPct}%, total ${outletCount} outlet)`
      : `setia di ${primaryOutletObj.outletName}`;
  const habitSummaryText = `Bertransaksi ${freqText}, ${outletText}, dominan ${dominantTimeSlot} (puncak ${peakHour}) dengan produk favorit ${topProdObj.produk}.`;

  return {
    tujuan: acc.tujuan,
    customerType,
    totalTrx: acc.totalTrx,
    gagalTrx: acc.gagalTrx,
    totalOmset: acc.totalOmset,
    totalLaba: acc.totalLaba,
    totalKomisi: acc.totalKomisi,
    avgTicketSize,
    activeDays,
    activeDates,
    maxTrxInOneDay,
    avgTrxPerActiveDay,
    avgTrxPerPeriodDay,
    estimatedPerWeek,
    peakHour,
    peakHourTrx: Math.max(0, peakHourTrx),
    dominantTimeSlot,
    activeHours,
    favoriteDayOfWeek,
    dowCounts: acc.dowCounts,
    primaryOutlet: primaryOutletObj.outletName,
    primaryOutletCode: primaryOutletObj.outletCode,
    primaryOutletGroup: primaryOutletObj.groupShortName,
    primaryOutletSubCluster: primaryOutletObj.subCluster,
    loyaltyPct,
    outletCount,
    isMultiOutlet,
    globalOutletCount,
    outlets: outletsList.slice(0, 5),
    topCategory: topCatObj.name,
    topCategories: categoriesList.slice(0, 3),
    topProduct: topProdObj.produk,
    topProducts: productsList.slice(0, 5),
    habitSegment,
    habitLabel,
    habitSummaryText,
  };
}

/**
 * Computes full Customer Habit Analytics per outlet & per target number across selected dates.
 */
export function computeCustomerHabitAnalytics({
  transactions = [],
  dates = [],
  periodLabel = '-',
  periodMode = 'weekly',
  categories = [],
  rules = [],
  groupFilter = 'ALL',
  outletFilter = 'ALL',
  segmentFilter = 'ALL',
  minTrx = 2,
  search = '',
  sortBy = 'trx_desc',
  page = 1,
  limit = 50,
}) {
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const compiledRules = compileRules(rules);
  const totalDaysInPeriod = Math.max(1, dates.length || new Set(transactions.map((t) => t.date).filter(Boolean)).size || 1);

  // Pass 1: Global multi-outlet detection & available outlet inventory
  const globalOutletMap = new Map(); // tujuan -> Map<outletName, count>
  const availableOutletsMap = new Map(); // outletName -> metadata + per-outlet customer accumulator
  const outletCache = new Map(); // "reseller||pengirim" -> evaluated outlet

  const getEvalOutlet = (tx) => {
    const key = `${tx.reseller || ''}||${tx.pengirim || ''}`;
    let ev = outletCache.get(key);
    if (!ev) {
      ev = evaluateOutlet(tx.reseller, tx.pengirim);
      outletCache.set(key, ev);
    }
    return ev;
  };

  for (const tx of transactions) {
    const tujuan = String(tx.tujuan || '').trim();
    if (!tujuan || tujuan === '-' || tujuan.toLowerCase() === '<null>') continue;
    const isSukses = tx.status === 'Sukses';
    if (!isSukses) continue;

    const outletEval = getEvalOutlet(tx);
    if (!globalOutletMap.has(tujuan)) {
      globalOutletMap.set(tujuan, new Map());
    }
    const gm = globalOutletMap.get(tujuan);
    gm.set(outletEval.outletName, (gm.get(outletEval.outletName) || 0) + 1);

    if (!availableOutletsMap.has(outletEval.outletName)) {
      availableOutletsMap.set(outletEval.outletName, {
        outletName: outletEval.outletName,
        outletCode: outletEval.outletCode,
        groupId: outletEval.groupId,
        groupShortName: outletEval.groupShortName,
        subCluster: outletEval.subCluster,
        isOfficialOutlet: outletEval.isOfficialOutlet,
        totalTrx: 0,
        totalOmset: 0,
        hourlyCounts: Array(24).fill(0),
        categories: new Map(),
        customers: new Map(), // tujuan -> { tujuan, trx, omset, dates: Set, products: Map, hours: Array(24) }
      });
    }
    const oAcc = availableOutletsMap.get(outletEval.outletName);
    if (oAcc.outletCode === '-' && outletEval.outletCode !== '-') {
      oAcc.outletCode = outletEval.outletCode;
    }
    oAcc.totalTrx++;
    oAcc.totalOmset += tx.hrgJual || 0;
    const hr = Math.max(0, Math.min(23, Number(tx.hour) || 0));
    oAcc.hourlyCounts[hr]++;

    const prodEval = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
    const catKey = prodEval.categoryId;
    if (!oAcc.categories.has(catKey)) {
      oAcc.categories.set(catKey, { name: prodEval.categoryName, trx: 0 });
    }
    oAcc.categories.get(catKey).trx++;

    if (!oAcc.customers.has(tujuan)) {
      oAcc.customers.set(tujuan, {
        tujuan,
        trx: 0,
        omset: 0,
        dates: new Set(),
        products: new Map(),
        hours: Array(24).fill(0),
      });
    }
    const oc = oAcc.customers.get(tujuan);
    oc.trx++;
    oc.omset += tx.hrgJual || 0;
    if (tx.date) oc.dates.add(tx.date);
    oc.products.set(tx.produk, (oc.products.get(tx.produk) || 0) + 1);
    oc.hours[hr]++;
  }

  // Pass 2: Aggregate customers in the selected groupFilter & outletFilter scope
  const customerAccMap = new Map();
  let scopeSuksesTrx = 0;
  let scopeOmset = 0;

  for (const tx of transactions) {
    const tujuan = String(tx.tujuan || '').trim();
    if (!tujuan || tujuan === '-' || tujuan.toLowerCase() === '<null>') continue;

    const outletEval = getEvalOutlet(tx);
    if (!matchesOutletScope(outletEval, groupFilter, outletFilter)) continue;

    if (!customerAccMap.has(tujuan)) {
      customerAccMap.set(tujuan, {
        tujuan,
        totalTrx: 0,
        gagalTrx: 0,
        totalOmset: 0,
        totalLaba: 0,
        totalKomisi: 0,
        dateCounts: new Map(),
        hourlyCounts: Array(24).fill(0),
        dowCounts: Array(7).fill(0),
        outlets: new Map(),
        categories: new Map(),
        products: new Map(),
      });
    }
    const acc = customerAccMap.get(tujuan);

    if (tx.status !== 'Sukses') {
      acc.gagalTrx++;
      continue;
    }

    scopeSuksesTrx++;
    scopeOmset += tx.hrgJual || 0;

    acc.totalTrx++;
    acc.totalOmset += tx.hrgJual || 0;
    acc.totalLaba += tx.laba || 0;
    acc.totalKomisi += tx.komisi || 0;

    if (tx.date) {
      acc.dateCounts.set(tx.date, (acc.dateCounts.get(tx.date) || 0) + 1);
      const dow = getDayOfWeekFromDateStr(tx.date);
      acc.dowCounts[dow]++;
    }

    const hr = Math.max(0, Math.min(23, Number(tx.hour) || 0));
    acc.hourlyCounts[hr]++;

    if (!acc.outlets.has(outletEval.outletName)) {
      acc.outlets.set(outletEval.outletName, {
        outletName: outletEval.outletName,
        outletCode: outletEval.outletCode,
        groupId: outletEval.groupId,
        groupShortName: outletEval.groupShortName,
        subCluster: outletEval.subCluster,
        trx: 0,
        omset: 0,
      });
    }
    const cOut = acc.outlets.get(outletEval.outletName);
    cOut.trx++;
    cOut.omset += tx.hrgJual || 0;

    const prodEval = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
    const catMeta = categoriesMap.get(prodEval.categoryId);
    if (!acc.categories.has(prodEval.categoryId)) {
      acc.categories.set(prodEval.categoryId, {
        categoryId: prodEval.categoryId,
        name: prodEval.categoryName,
        shortName: catMeta?.shortName || prodEval.categoryName,
        color: catMeta?.color || '#6366f1',
        trx: 0,
        omset: 0,
      });
    }
    const cCat = acc.categories.get(prodEval.categoryId);
    cCat.trx++;
    cCat.omset += tx.hrgJual || 0;

    if (!acc.products.has(tx.produk)) {
      acc.products.set(tx.produk, {
        produk: tx.produk,
        subCategory: prodEval.subCategory,
        trx: 0,
        omset: 0,
      });
    }
    const cProd = acc.products.get(tx.produk);
    cProd.trx++;
    cProd.omset += tx.hrgJual || 0;
  }

  // Finalize all customer records in scope (excluding pure failed-only records with 0 sukses)
  const allCustomers = [];
  const segmentBreakdown = {
    vip_power: 0,
    rutin_harian: 0,
    rutin_mingguan: 0,
    repeat_harian: 0,
    reguler: 0,
  };
  let repeatCustomersCount = 0;
  let repeatTrxCount = 0;
  let repeatOmset = 0;
  let multiOutletCustomersCount = 0;

  for (const acc of customerAccMap.values()) {
    if (acc.totalTrx <= 0) continue;
    const item = finalizeCustomerHabitRecord(acc, { totalDaysInPeriod, globalOutletMap });
    allCustomers.push(item);
    segmentBreakdown[item.habitSegment] = (segmentBreakdown[item.habitSegment] || 0) + 1;
    if (item.totalTrx >= 2) {
      repeatCustomersCount++;
      repeatTrxCount += item.totalTrx;
      repeatOmset += item.totalOmset;
    }
    if (item.isMultiOutlet) {
      multiOutletCustomersCount++;
    }
  }

  allCustomers.sort((a, b) => b.totalTrx - a.totalTrx || b.totalOmset - a.totalOmset);

  const totalUniqueCustomers = allCustomers.length;
  const repeatRatePct =
    totalUniqueCustomers > 0
      ? Number(((repeatCustomersCount / totalUniqueCustomers) * 100).toFixed(1))
      : 0;
  const repeatTrxSharePct =
    scopeSuksesTrx > 0 ? Number(((repeatTrxCount / scopeSuksesTrx) * 100).toFixed(1)) : 0;
  const repeatOmsetSharePct =
    scopeOmset > 0 ? Number(((repeatOmset / scopeOmset) * 100).toFixed(1)) : 0;
  const avgTrxPerCustomer =
    totalUniqueCustomers > 0
      ? Number((scopeSuksesTrx / totalUniqueCustomers).toFixed(2))
      : 0;

  // Build per-outlet summaries (respecting groupFilter)
  const outletSummaries = [];
  const availableOutlets = [];

  for (const oAcc of availableOutletsMap.values()) {
    availableOutlets.push({
      outletName: oAcc.outletName,
      outletCode: oAcc.outletCode,
      groupId: oAcc.groupId,
      groupShortName: oAcc.groupShortName,
      subCluster: oAcc.subCluster,
      isOfficialOutlet: oAcc.isOfficialOutlet,
      totalTrx: oAcc.totalTrx,
      totalOmset: oAcc.totalOmset,
    });

    if (!matchesOutletScope(oAcc, groupFilter, 'ALL')) continue;

    let uniqueCustomers = 0;
    let repeatCustomers = 0;
    let outletRepeatTrx = 0;
    const custArr = [];

    for (const oc of oAcc.customers.values()) {
      uniqueCustomers++;
      if (oc.trx >= 2) {
        repeatCustomers++;
        outletRepeatTrx += oc.trx;
      }
      let topProduct = '-';
      let topProdCnt = 0;
      for (const [pName, pCnt] of oc.products.entries()) {
        if (pCnt > topProdCnt) {
          topProdCnt = pCnt;
          topProduct = pName;
        }
      }
      let peakHr = 0;
      let peakHrCnt = -1;
      for (let hr = 0; hr < 24; hr++) {
        if (oc.hours[hr] > peakHrCnt) {
          peakHrCnt = oc.hours[hr];
          peakHr = hr;
        }
      }
      const activeDays = oc.dates.size || 1;
      custArr.push({
        tujuan: oc.tujuan,
        trx: oc.trx,
        activeDays,
        omset: oc.omset,
        topProduct,
        peakHour: `${String(peakHr).padStart(2, '0')}:00`,
        habitSegment: classifyHabitSegment({
          totalTrx: oc.trx,
          activeDays,
          totalDaysInPeriod,
          maxTrxInOneDay: oc.trx,
          totalOmset: oc.omset,
        }),
      });
    }

    custArr.sort((a, b) => b.trx - a.trx || b.omset - a.omset);

    let topCategory = '-';
    let topCatTrx = 0;
    for (const cat of oAcc.categories.values()) {
      if (cat.trx > topCatTrx) {
        topCatTrx = cat.trx;
        topCategory = cat.name;
      }
    }

    outletSummaries.push({
      outletName: oAcc.outletName,
      outletCode: oAcc.outletCode,
      groupId: oAcc.groupId,
      groupShortName: oAcc.groupShortName,
      subCluster: oAcc.subCluster,
      isOfficialOutlet: oAcc.isOfficialOutlet,
      totalTrx: oAcc.totalTrx,
      totalOmset: oAcc.totalOmset,
      uniqueCustomers,
      repeatCustomers,
      repeatTrxCount: outletRepeatTrx,
      repeatRatePct:
        uniqueCustomers > 0 ? Number(((repeatCustomers / uniqueCustomers) * 100).toFixed(1)) : 0,
      repeatTrxSharePct:
        oAcc.totalTrx > 0 ? Number(((outletRepeatTrx / oAcc.totalTrx) * 100).toFixed(1)) : 0,
      avgTrxPerCustomer:
        uniqueCustomers > 0 ? Number((oAcc.totalTrx / uniqueCustomers).toFixed(2)) : 0,
      dominantTimeSlot: resolveDominantTimeSlot(oAcc.hourlyCounts),
      topCategory,
      topFrequentNumbers: custArr.slice(0, 5),
    });
  }

  outletSummaries.sort(
    (a, b) =>
      b.repeatCustomers - a.repeatCustomers ||
      b.repeatRatePct - a.repeatRatePct ||
      b.totalTrx - a.totalTrx
  );
  availableOutlets.sort((a, b) => b.totalOmset - a.totalOmset || b.totalTrx - a.totalTrx);

  // Filter & Sort Customers for Table
  const minTrxNum = Math.max(1, parseInt(minTrx, 10) || 1);
  const q = String(search || '').trim().toLowerCase();

  const filteredCustomers = allCustomers.filter((c) => {
    if (c.totalTrx < minTrxNum) return false;
    if (segmentFilter && segmentFilter !== 'ALL') {
      if (segmentFilter === 'multi_outlet') {
        if (!c.isMultiOutlet) return false;
      } else if (c.habitSegment !== segmentFilter) {
        return false;
      }
    }
    if (q) {
      const hay = `${c.tujuan} ${c.primaryOutlet} ${c.topProduct} ${c.topCategory} ${c.customerType} ${c.habitLabel}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sortBy === 'omset_desc') {
    filteredCustomers.sort((a, b) => b.totalOmset - a.totalOmset || b.totalTrx - a.totalTrx);
  } else if (sortBy === 'active_days_desc') {
    filteredCustomers.sort((a, b) => b.activeDays - a.activeDays || b.totalTrx - a.totalTrx || b.totalOmset - a.totalOmset);
  } else if (sortBy === 'avg_per_day_desc') {
    filteredCustomers.sort((a, b) => b.maxTrxInOneDay - a.maxTrxInOneDay || b.totalTrx - a.totalTrx);
  } else if (sortBy === 'multi_outlet_desc') {
    filteredCustomers.sort((a, b) => b.globalOutletCount - a.globalOutletCount || b.totalTrx - a.totalTrx);
  } else {
    filteredCustomers.sort((a, b) => b.totalTrx - a.totalTrx || b.totalOmset - a.totalOmset);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(10, Math.min(200, parseInt(limit, 10) || 50));
  const totalFiltered = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limitNum));
  const safePage = Math.min(pageNum, totalPages);
  const startIdx = (safePage - 1) * limitNum;
  const pagedCustomers = filteredCustomers.slice(startIdx, startIdx + limitNum);

  return {
    summary: {
      totalDaysInPeriod,
      dates,
      periodLabel,
      periodMode,
      totalSuksesTrx: scopeSuksesTrx,
      totalOmset: scopeOmset,
      totalUniqueCustomers,
      repeatCustomersCount,
      repeatRatePct,
      repeatTrxCount,
      repeatTrxSharePct,
      repeatOmset,
      repeatOmsetSharePct,
      multiOutletCustomersCount,
      powerCustomersCount: segmentBreakdown.vip_power || 0,
      avgTrxPerCustomer,
      segmentBreakdown,
      topCustomer: allCustomers[0] || null,
      topOutletByRepeat: outletSummaries[0] || null,
    },
    customers: pagedCustomers,
    pagination: {
      total: totalFiltered,
      page: safePage,
      limit: limitNum,
      totalPages,
    },
    outletSummaries,
    availableOutlets,
  };
}

/**
 * Computes deep 360° habit detail for a single target customer number (tujuan).
 */
export function computeCustomerHabitDetail({
  transactions = [],
  dates = [],
  periodLabel = '-',
  tujuan = '',
  categories = [],
  rules = [],
}) {
  const target = String(tujuan || '').trim();
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const compiledRules = compileRules(rules);
  const totalDaysInPeriod = Math.max(1, dates.length || 1);

  const acc = {
    tujuan: target,
    totalTrx: 0,
    gagalTrx: 0,
    totalOmset: 0,
    totalLaba: 0,
    totalKomisi: 0,
    dateCounts: new Map(),
    hourlyCounts: Array(24).fill(0),
    dowCounts: Array(7).fill(0),
    outlets: new Map(),
    categories: new Map(),
    products: new Map(),
  };

  const hourlyDistribution = Array.from({ length: 24 }, (_, hr) => ({
    hour: hr,
    label: `${String(hr).padStart(2, '0')}:00`,
    trx: 0,
    omset: 0,
  }));
  const dayOfWeekDistribution = INDO_DAY_NAMES.map((label, dow) => ({
    dow,
    label,
    trx: 0,
    omset: 0,
  }));
  const dailyMap = new Map();
  const matchedTx = [];

  for (const tx of transactions) {
    if (String(tx.tujuan || '').trim() !== target) continue;

    const outletEval = evaluateOutlet(tx.reseller, tx.pengirim);
    const prodEval = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
    const hr = Math.max(0, Math.min(23, Number(tx.hour) || 0));

    matchedTx.push({
      id: tx.id,
      tglEntri: tx.tglEntri,
      date: tx.date,
      hour: hr,
      reseller: outletEval.outletName,
      outletCode: outletEval.outletCode,
      produk: tx.produk,
      categoryName: prodEval.categoryName,
      subCategory: prodEval.subCategory,
      hrgJual: tx.hrgJual || 0,
      laba: tx.laba || 0,
      komisi: tx.komisi || 0,
      status: tx.status,
      modul: tx.modul,
    });

    if (tx.status !== 'Sukses') {
      acc.gagalTrx++;
      continue;
    }

    acc.totalTrx++;
    acc.totalOmset += tx.hrgJual || 0;
    acc.totalLaba += tx.laba || 0;
    acc.totalKomisi += tx.komisi || 0;

    hourlyDistribution[hr].trx++;
    hourlyDistribution[hr].omset += tx.hrgJual || 0;
    acc.hourlyCounts[hr]++;

    if (tx.date) {
      acc.dateCounts.set(tx.date, (acc.dateCounts.get(tx.date) || 0) + 1);
      const dow = getDayOfWeekFromDateStr(tx.date);
      acc.dowCounts[dow]++;
      dayOfWeekDistribution[dow].trx++;
      dayOfWeekDistribution[dow].omset += tx.hrgJual || 0;

      if (!dailyMap.has(tx.date)) {
        dailyMap.set(tx.date, {
          date: tx.date,
          dayLabel: INDO_DAY_NAMES[dow],
          trx: 0,
          omset: 0,
          outlets: new Map(),
          products: new Map(),
        });
      }
      const dEntry = dailyMap.get(tx.date);
      dEntry.trx++;
      dEntry.omset += tx.hrgJual || 0;
      dEntry.outlets.set(outletEval.outletName, (dEntry.outlets.get(outletEval.outletName) || 0) + 1);
      dEntry.products.set(tx.produk, (dEntry.products.get(tx.produk) || 0) + 1);
    }

    if (!acc.outlets.has(outletEval.outletName)) {
      acc.outlets.set(outletEval.outletName, {
        outletName: outletEval.outletName,
        outletCode: outletEval.outletCode,
        groupId: outletEval.groupId,
        groupShortName: outletEval.groupShortName,
        subCluster: outletEval.subCluster,
        trx: 0,
        omset: 0,
      });
    }
    const oAcc = acc.outlets.get(outletEval.outletName);
    oAcc.trx++;
    oAcc.omset += tx.hrgJual || 0;

    const catMeta = categoriesMap.get(prodEval.categoryId);
    if (!acc.categories.has(prodEval.categoryId)) {
      acc.categories.set(prodEval.categoryId, {
        categoryId: prodEval.categoryId,
        name: prodEval.categoryName,
        shortName: catMeta?.shortName || prodEval.categoryName,
        color: catMeta?.color || '#6366f1',
        trx: 0,
        omset: 0,
      });
    }
    const cCat = acc.categories.get(prodEval.categoryId);
    cCat.trx++;
    cCat.omset += tx.hrgJual || 0;

    if (!acc.products.has(tx.produk)) {
      acc.products.set(tx.produk, {
        produk: tx.produk,
        subCategory: prodEval.subCategory,
        trx: 0,
        omset: 0,
      });
    }
    const cProd = acc.products.get(tx.produk);
    cProd.trx++;
    cProd.omset += tx.hrgJual || 0;
  }

  const profile = finalizeCustomerHabitRecord(acc, { totalDaysInPeriod, globalOutletMap: null });

  const outletBreakdown = Array.from(acc.outlets.values())
    .sort((a, b) => b.trx - a.trx || b.omset - a.omset)
    .map((o) => ({
      ...o,
      sharePct: acc.totalTrx > 0 ? Number(((o.trx / acc.totalTrx) * 100).toFixed(1)) : 0,
    }));

  const categoryBreakdown = Array.from(acc.categories.values())
    .sort((a, b) => b.trx - a.trx || b.omset - a.omset)
    .map((c) => ({
      ...c,
      sharePct: acc.totalTrx > 0 ? Number(((c.trx / acc.totalTrx) * 100).toFixed(1)) : 0,
    }));

  const productBreakdown = Array.from(acc.products.values()).sort(
    (a, b) => b.trx - a.trx || b.omset - a.omset
  );

  const dailyTimeline = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      dayLabel: d.dayLabel,
      trx: d.trx,
      omset: d.omset,
      outlets: Array.from(d.outlets.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
      topProducts: Array.from(d.products.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([produk, count]) => ({ produk, count })),
    }));

  matchedTx.sort((a, b) => String(b.tglEntri).localeCompare(String(a.tglEntri)));

  return {
    periodLabel,
    totalDaysInPeriod,
    profile,
    hourlyDistribution,
    dayOfWeekDistribution,
    dailyTimeline,
    outletBreakdown,
    categoryBreakdown,
    productBreakdown,
    transactions: matchedTx.slice(0, 200),
    totalMatchedTransactions: matchedTx.length,
  };
}

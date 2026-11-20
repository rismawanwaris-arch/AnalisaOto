import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from './defaults.js';
import {
  parseExcelBuffer,
  compileRules,
  evaluateProduct,
  scanUncategorizedProducts,
} from './engine.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const TX_DIR = path.join(DATA_DIR, 'transactions');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');
const UPLOADS_FILE = path.join(DATA_DIR, 'uploads.json');

// In-memory caches to eliminate repeated full-disk JSON parsing on every request
const txCache = new Map(); // safeDate -> transactions[]
let categoriesCache = null;
let rulesCache = null;
let datesSummaryCache = null;
let globalUncatCache = null;

function invalidateDerivedCaches() {
  datesSummaryCache = null;
  globalUncatCache = null;
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TX_DIR)) {
    fs.mkdirSync(TX_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  ensureDirectories();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Ignore temp cleanup errors
      }
    }
    throw err;
  }
}

export function getCategories() {
  if (categoriesCache) {
    return [...categoriesCache];
  }
  ensureDirectories();
  const cats = readJson(CATEGORIES_FILE, null);
  if (!cats || !Array.isArray(cats) || cats.length === 0) {
    writeJsonAtomic(CATEGORIES_FILE, DEFAULT_CATEGORIES);
    categoriesCache = [...DEFAULT_CATEGORIES];
    return [...categoriesCache];
  }
  categoriesCache = cats;
  return [...categoriesCache];
}

export function saveCategories(categories) {
  writeJsonAtomic(CATEGORIES_FILE, categories);
  categoriesCache = [...categories];
  invalidateDerivedCaches();
  return categories;
}

export function getRules() {
  if (rulesCache) {
    return [...rulesCache];
  }
  ensureDirectories();
  const rules = readJson(RULES_FILE, null);
  if (!rules || !Array.isArray(rules)) {
    writeJsonAtomic(RULES_FILE, DEFAULT_RULES);
    rulesCache = [...DEFAULT_RULES];
    return [...rulesCache];
  }
  rulesCache = rules;
  return [...rulesCache];
}

export function saveRules(rules) {
  writeJsonAtomic(RULES_FILE, rules);
  rulesCache = [...rules];
  invalidateDerivedCaches();
  return rules;
}

export function resetCategoriesAndRulesToDefault() {
  writeJsonAtomic(CATEGORIES_FILE, DEFAULT_CATEGORIES);
  writeJsonAtomic(RULES_FILE, DEFAULT_RULES);
  categoriesCache = [...DEFAULT_CATEGORIES];
  rulesCache = [...DEFAULT_RULES];
  invalidateDerivedCaches();
  return {
    categories: [...DEFAULT_CATEGORIES],
    rules: [...DEFAULT_RULES],
  };
}

export function getUploadHistory() {
  ensureDirectories();
  return readJson(UPLOADS_FILE, []);
}

export function addUploadRecord(record) {
  const history = getUploadHistory();
  const updated = [record, ...history].slice(0, 100);
  writeJsonAtomic(UPLOADS_FILE, updated);
  return updated;
}

export function getTransactionsForDate(dateStr) {
  ensureDirectories();
  const safeDate = String(dateStr).replace(/[^0-9-]/g, '');
  if (!safeDate) return [];
  if (txCache.has(safeDate)) {
    return txCache.get(safeDate);
  }
  const filePath = path.join(TX_DIR, `${safeDate}.json`);
  const txs = readJson(filePath, []);
  if (fs.existsSync(filePath)) {
    txCache.set(safeDate, txs);
  }
  return txs;
}

export function saveTransactionsForDate(dateStr, transactions, mode = 'replace') {
  ensureDirectories();
  const safeDate = String(dateStr).replace(/[^0-9-]/g, '');
  const filePath = path.join(TX_DIR, `${safeDate}.json`);

  let finalTx = transactions;
  if (mode === 'append' && fs.existsSync(filePath)) {
    const existing = getTransactionsForDate(safeDate);
    finalTx = [...existing, ...transactions];
  }

  writeJsonAtomic(filePath, finalTx);
  txCache.set(safeDate, finalTx);
  invalidateDerivedCaches();
  return finalTx.length;
}

export function deleteTransactionsForDate(dateStr) {
  ensureDirectories();
  const safeDate = String(dateStr).replace(/[^0-9-]/g, '');
  const filePath = path.join(TX_DIR, `${safeDate}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    txCache.delete(safeDate);
    invalidateDerivedCaches();
    return true;
  }
  return false;
}

export function listAvailableDatesSummary() {
  if (datesSummaryCache) {
    return datesSummaryCache;
  }
  ensureDirectories();
  const files = fs.readdirSync(TX_DIR).filter((f) => f.endsWith('.json'));
  const categories = getCategories();
  const rules = getRules();
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const compiledRules = compileRules(rules);

  const summaries = [];
  for (const file of files) {
    const date = file.replace('.json', '');
    const txs = getTransactionsForDate(date);
    let omset = 0;
    let laba = 0;
    let komisi = 0;
    let suksesTrx = 0;
    let gagalTrx = 0;
    const uncategorizedCodes = new Set();
    let uncategorizedTrx = 0;

    for (const tx of txs) {
      const ev = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
      if (!ev.isCategorized) {
        uncategorizedCodes.add(tx.produk);
        uncategorizedTrx++;
      }
      if (tx.status === 'Sukses') {
        suksesTrx++;
        omset += tx.hrgJual;
        laba += tx.laba;
        komisi += tx.komisi;
      } else {
        gagalTrx++;
      }
    }

    summaries.push({
      date,
      totalTrx: txs.length,
      suksesTrx,
      gagalTrx,
      omset,
      laba,
      komisi,
      uncategorizedProductCount: uncategorizedCodes.size,
      uncategorizedTrx,
    });
  }

  summaries.sort((a, b) => b.date.localeCompare(a.date));
  datesSummaryCache = summaries;
  return summaries;
}

export function getAllTransactionsAcrossDates(datesList = null) {
  ensureDirectories();
  const targetDates =
    datesList && datesList.length > 0
      ? datesList
      : fs
          .readdirSync(TX_DIR)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.replace('.json', ''))
          .sort();

  const all = [];
  for (const d of targetDates) {
    const txs = getTransactionsForDate(d);
    for (const tx of txs) {
      all.push(tx);
    }
  }
  return all;
}

export function getGlobalUncategorizedReport() {
  if (globalUncatCache) {
    return globalUncatCache;
  }
  const allTx = getAllTransactionsAcrossDates();
  const categories = getCategories();
  const rules = getRules();
  const report = scanUncategorizedProducts(allTx, rules, categories);
  globalUncatCache = report;
  return report;
}

export function getDetectedProductsCatalog() {
  const allTx = getAllTransactionsAcrossDates();
  const categories = getCategories();
  const rules = getRules();
  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const compiledRules = compileRules(rules);
  const rulesMap = new Map(rules.map((r) => [r.id, r]));

  const catalog = new Map();
  for (const tx of allTx) {
    let entry = catalog.get(tx.produk);
    if (!entry) {
      const ev = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
      const matchedRule = ev.matchedRuleId ? rulesMap.get(ev.matchedRuleId) : null;
      entry = {
        produk: tx.produk,
        modul: tx.modul,
        sampleTujuan: tx.tujuan,
        frequency: 0,
        suksesCount: 0,
        totalOmset: 0,
        totalLaba: 0,
        isCategorized: ev.isCategorized,
        categoryId: ev.categoryId,
        categoryName: ev.categoryName,
        subCategory: ev.subCategory,
        matchedRuleId: ev.matchedRuleId,
        matchedRulePattern: matchedRule ? `${matchedRule.matchType.toUpperCase()}: ${matchedRule.pattern}` : 'Belum Ada Aturan',
      };
      catalog.set(tx.produk, entry);
    }
    entry.frequency++;
    if (tx.status === 'Sukses') {
      entry.suksesCount++;
      entry.totalOmset += tx.hrgJual;
      entry.totalLaba += tx.laba;
    }
  }

  return Array.from(catalog.values()).sort((a, b) => b.totalOmset - a.totalOmset || b.frequency - a.frequency);
}

/**
 * Seeds initial real transaction data from sample-data if no dates exist yet
 */
export async function ensureSeedDataIfEmpty() {
  ensureDirectories();
  const existingFiles = fs.readdirSync(TX_DIR).filter((f) => f.endsWith('.json'));
  if (existingFiles.length > 0) {
    return;
  }

  const sampleDir = path.join(process.cwd(), 'sample-data');
  const sampleFiles = ['TRX 1-11-26.xlsx', 'TRX 2-11-26.xlsx'];

  for (const fileName of sampleFiles) {
    const filePath = path.join(sampleDir, fileName);
    if (fs.existsSync(filePath)) {
      try {
        const buffer = fs.readFileSync(filePath);
        const parsed = await parseExcelBuffer(buffer, fileName);
        for (const [date, rows] of Object.entries(parsed.byDate)) {
          saveTransactionsForDate(date, rows, 'replace');
        }
        addUploadRecord({
          id: `seed_${Date.now()}_${fileName}`,
          timestamp: new Date().toISOString(),
          fileName,
          mode: 'seed',
          totalRows: parsed.validRowCount,
          dates: parsed.dates,
        });
        console.log(`[Seed] Loaded ${parsed.validRowCount} rows from ${fileName} for dates: ${parsed.dates.join(', ')}`);
      } catch (err) {
        console.error(`[Seed] Failed loading ${fileName}:`, err);
      }
    }
  }
}

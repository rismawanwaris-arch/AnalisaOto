import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  requireAuth,
  ensureAuthInitialized,
  handleAuthStatus,
  handleLogin,
  handleLogout,
  handleChangePassword,
} from './auth.js';
import {
  ensureSeedDataIfEmpty,
  getCategories,
  saveCategories,
  getRules,
  saveRules,
  resetCategoriesAndRulesToDefault,
  listAvailableDatesSummary,
  saveTransactionsForDate,
  deleteTransactionsForDate,
  getAllTransactionsAcrossDates,
  getGlobalUncategorizedReport,
  getDetectedProductsCatalog,
  getUploadHistory,
  addUploadRecord,
} from './storage.js';
import {
  parseExcelBuffer,
  computeComparisonAnalytics,
  scanUncategorizedProducts,
  compileRules,
  evaluateProduct,
} from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ENABLE_DEMO_TOOLS = process.env.ENABLE_DEMO_TOOLS === 'true' || !IS_PROD;

// Trust reverse proxy only when explicitly behind Nginx Proxy Manager / Caddy / Cloudflare Tunnel
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// 1. Security Headers (Helmet) - configured to allow local HTTP LAN access without forced HTTPS upgrade
app.use(
  helmet({
    strictTransportSecurity: false,
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);

// 2. Strict CORS Policy (Reject arbitrary external websites)
const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors((req, callback) => {
    const origin = req.header('Origin');
    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }
    try {
      const originHost = new URL(origin).host;
      const reqHost = req.get('host');
      if (originHost && reqHost && originHost === reqHost) {
        return callback(null, { origin: true, credentials: true });
      }
    } catch {
      // Invalid Origin header
    }
    if (envAllowedOrigins.includes(origin) || (!IS_PROD && defaultDevOrigins.includes(origin))) {
      return callback(null, { origin: true, credentials: true });
    }
    return callback(new Error('Origin tidak diizinkan oleh kebijakan CORS.'));
  })
);

app.use(express.json({ limit: '10mb' }));

// 3. Rate Limiting (Anti Brute-Force & Anti DoS)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak percobaan login gagal. Silakan tunggu 15 menit sebelum mencoba lagi.',
  },
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak permintaan ke server. Silakan tunggu beberapa saat.',
  },
});

app.use('/api', apiLimiter);

// 4. Auth Endpoints (Public status/login/logout, Protected change-password)
app.get('/api/auth/status', handleAuthStatus);
app.post('/api/auth/login', loginLimiter, handleLogin);
app.post('/api/auth/logout', handleLogout);
app.post('/api/auth/change-password', requireAuth, handleChangePassword);

// 5. Global Authentication Gate for all other /api/* endpoints
app.use('/api', (req, res, next) => {
  if (
    req.path === '/auth/status' ||
    req.path === '/auth/login' ||
    req.path === '/auth/logout'
  ) {
    return next();
  }
  return requireAuth(req, res, next);
});

const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.xlsx', '.csv']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 15 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return cb(new Error('Format file ditolak. Hanya file Excel (.xlsx, .csv) yang diizinkan.'));
    }
    cb(null, true);
  },
});

function safeServerError(res, err, fallbackMessage = 'Terjadi kesalahan internal pada server.') {
  console.error(err);
  return res.status(500).json({
    error: IS_PROD ? fallbackMessage : err.message || fallbackMessage,
  });
}

function formatIndonesianDate(dateStr) {
  if (!dateStr) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const mIdx = parseInt(m, 10) - 1;
  return `${d} ${months[mIdx] || m} ${y}`;
}

/**
 * Resolves D1 and D2 date arrays based on preset or custom dates
 */
function resolveComparisonPeriod(preset, customD1, customD2, availableDates) {
  const sortedDesc = [...availableDates].sort((a, b) => b.localeCompare(a));
  const latestDate = sortedDesc[0] || '2026-11-02';
  const secondLatestDate = sortedDesc[1] || sortedDesc[0] || '2026-11-01';

  if (preset === 'this_week_vs_last_week') {
    // Group up to 7 most recent available dates vs previous dates, or split available dates
    if (sortedDesc.length >= 2) {
      const half = Math.max(1, Math.min(7, Math.ceil(sortedDesc.length / 2)));
      const d1Dates = sortedDesc.slice(0, half).sort();
      const d2Dates = sortedDesc.slice(half, half * 2).sort();
      if (d2Dates.length === 0) d2Dates.push(sortedDesc[sortedDesc.length - 1]);
      const d1Label =
        d1Dates.length === 1
          ? formatIndonesianDate(d1Dates[0])
          : `${formatIndonesianDate(d1Dates[0])} - ${formatIndonesianDate(d1Dates[d1Dates.length - 1])}`;
      const d2Label =
        d2Dates.length === 1
          ? formatIndonesianDate(d2Dates[0])
          : `${formatIndonesianDate(d2Dates[0])} - ${formatIndonesianDate(d2Dates[d2Dates.length - 1])}`;
      return { d1Dates, d2Dates, d1Label, d2Label };
    }
  }

  if (preset === 'today_vs_yesterday') {
    // If today's date exists, use it; otherwise use latest two dates
    const d1 = sortedDesc[0] || latestDate;
    const d2 = sortedDesc[1] || secondLatestDate;
    return {
      d1Dates: [d1],
      d2Dates: [d2],
      d1Label: formatIndonesianDate(d1),
      d2Label: formatIndonesianDate(d2),
    };
  }

  if (preset === 'yesterday_vs_daybefore') {
    // Prefer 2026-11-02 vs 2026-11-01 if both exist (matching PRD default)
    if (sortedDesc.includes('2026-11-02') && sortedDesc.includes('2026-11-01')) {
      return {
        d1Dates: ['2026-11-02'],
        d2Dates: ['2026-11-01'],
        d1Label: formatIndonesianDate('2026-11-02'),
        d2Label: formatIndonesianDate('2026-11-01'),
      };
    }
    const d1 = sortedDesc[0] || latestDate;
    const d2 = sortedDesc[1] || secondLatestDate;
    return {
      d1Dates: [d1],
      d2Dates: [d2],
      d1Label: formatIndonesianDate(d1),
      d2Label: formatIndonesianDate(d2),
    };
  }

  // Custom date selection
  const d1 = customD1 || latestDate;
  const d2 = customD2 || secondLatestDate;
  return {
    d1Dates: [d1],
    d2Dates: [d2],
    d1Label: formatIndonesianDate(d1),
    d2Label: formatIndonesianDate(d2),
  };
}

// 1. Bootstrap endpoint
app.get('/api/bootstrap', (req, res) => {
  try {
    const datesSummary = listAvailableDatesSummary();
    const categories = getCategories();
    const rules = getRules();
    const uploadHistory = getUploadHistory();
    const uncategorized = getGlobalUncategorizedReport();

    res.json({
      datesSummary,
      categories,
      rules,
      uploadHistory,
      uncategorized,
      demoToolsEnabled: ENABLE_DEMO_TOOLS,
    });
  } catch (err) {
    console.error('Error in /api/bootstrap:', err);
    return safeServerError(res, err);
  }
});

// 2. Analytics comparison endpoint
app.get('/api/analytics', (req, res) => {
  try {
    const { preset = 'custom', d1, d2 } = req.query;
    const datesSummary = listAvailableDatesSummary();
    const availableDates = datesSummary.map((d) => d.date);

    const { d1Dates, d2Dates, d1Label, d2Label } = resolveComparisonPeriod(
      preset,
      d1,
      d2,
      availableDates
    );

    const d1Transactions = getAllTransactionsAcrossDates(d1Dates);
    const d2Transactions = getAllTransactionsAcrossDates(d2Dates);
    const categories = getCategories();
    const rules = getRules();
    const globalUncategorizedReport = getGlobalUncategorizedReport();

    const analytics = computeComparisonAnalytics({
      d1Transactions,
      d2Transactions,
      d1Label,
      d2Label,
      d1Dates,
      d2Dates,
      categories,
      rules,
      globalUncategorizedReport,
    });

    res.json({
      ...analytics,
      datesSummary,
    });
  } catch (err) {
    console.error('Error in /api/analytics:', err);
    return safeServerError(res, err);
  }
});

// 3. Upload Excel files (Single Day or Multi-Day / Multi-File Batch)
app.post('/api/upload', upload.array('files', 15), async (req, res) => {
  try {
    const files = req.files || [];
    const writeMode = req.body.writeMode || 'replace'; // 'replace' or 'append'
    const uploadMode = req.body.uploadMode || 'single'; // 'single' or 'batch'

    if (files.length === 0) {
      return res.status(400).json({ error: 'Tidak ada file Excel yang diunggah.' });
    }

    const aggregatedByDate = {};
    const processedFiles = [];
    let totalValidRows = 0;

    for (const file of files) {
      const parsed = await parseExcelBuffer(file.buffer, file.originalname);
      totalValidRows += parsed.validRowCount;
      processedFiles.push({
        fileName: file.originalname,
        rows: parsed.validRowCount,
        dates: parsed.dates,
      });

      for (const [date, rows] of Object.entries(parsed.byDate)) {
        if (!aggregatedByDate[date]) {
          aggregatedByDate[date] = [];
        }
        aggregatedByDate[date].push(...rows);
      }
    }

    const affectedDates = Object.keys(aggregatedByDate).sort();
    const uploadedTransactions = [];

    for (const date of affectedDates) {
      const rows = aggregatedByDate[date];
      saveTransactionsForDate(date, rows, writeMode);
      uploadedTransactions.push(...rows);
    }

    addUploadRecord({
      id: `up_${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: files.map((f) => f.originalname).join(', '),
      mode: uploadMode,
      writeMode,
      totalRows: totalValidRows,
      dates: affectedDates,
    });

    const categories = getCategories();
    const rules = getRules();
    const uploadUncategorized = scanUncategorizedProducts(uploadedTransactions, rules, categories);
    const globalUncategorized = getGlobalUncategorizedReport();
    const datesSummary = listAvailableDatesSummary();

    res.json({
      success: true,
      totalValidRows,
      affectedDates,
      processedFiles,
      uploadUncategorized,
      globalUncategorized,
      datesSummary,
    });
  } catch (err) {
    console.error('Error in /api/upload:', err);
    res.status(400).json({ error: err.message });
  }
});

// 4. Simulate Uncategorized Products (disabled in production unless ENABLE_DEMO_TOOLS=true)
app.post('/api/simulate-new-products', async (req, res) => {
  if (!ENABLE_DEMO_TOOLS) {
    return res.status(403).json({
      error: 'Fitur simulasi/sampel dinonaktifkan di mode produksi.',
    });
  }
  try {
    const { mode = 'prd_example' } = req.body || {};

    if (mode === 'upload_sample_file') {
      const simPath = path.join(process.cwd(), 'sample-data', 'SIMULASI_PRODUK_BARU_3-11-26.xlsx');
      if (!fs.existsSync(simPath)) {
        return res.status(404).json({ error: 'File sampel simulasi tidak ditemukan.' });
      }
      const buffer = fs.readFileSync(simPath);
      const parsed = await parseExcelBuffer(buffer, 'SIMULASI_PRODUK_BARU_3-11-26.xlsx');
      for (const [date, rows] of Object.entries(parsed.byDate)) {
        saveTransactionsForDate(date, rows, 'replace');
      }
      addUploadRecord({
        id: `sim_${Date.now()}`,
        timestamp: new Date().toISOString(),
        fileName: 'SIMULASI_PRODUK_BARU_3-11-26.xlsx (Simulasi Uji Produk Baru)',
        mode: 'simulation',
        totalRows: parsed.validRowCount,
        dates: parsed.dates,
      });
    } else {
      // PRD Section 3.2 exact example: temporarily remove rules that match MAXD10, VIY2, HDTF* so they appear in Uncategorized Interceptor on 2026-11-02!
      const currentRules = getRules();
      const filteredRules = currentRules.filter(
        (r) => !['MAXD', 'VIY', 'HDTF', 'AH', 'AM'].includes(String(r.pattern).toUpperCase())
      );
      saveRules(filteredRules);
    }

    const globalUncategorized = getGlobalUncategorizedReport();
    const datesSummary = listAvailableDatesSummary();
    const rules = getRules();

    res.json({
      success: true,
      mode,
      globalUncategorized,
      datesSummary,
      rules,
    });
  } catch (err) {
    console.error('Error in /api/simulate-new-products:', err);
    return safeServerError(res, err);
  }
});

// 5. Batch Mapping from Interactive Mapping Wizard (Instant Recalculation)
app.post('/api/rules/batch-map', (req, res) => {
  try {
    const { mappings = [], newCategories = [] } = req.body;
    let categories = getCategories();
    let rules = getRules();

    // Add any newly created categories first
    if (Array.isArray(newCategories) && newCategories.length > 0) {
      for (const nc of newCategories) {
        if (!nc.name) continue;
        const id = nc.id || `cat_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        if (!categories.some((c) => c.id === id)) {
          categories.push({
            id,
            name: nc.name,
            shortName: nc.shortName || nc.name,
            color: nc.color || '#8b5cf6',
            icon: nc.icon || 'Tag',
            description: nc.description || 'Kategori kustom pengguna',
            order: categories.length + 1,
          });
        }
      }
      saveCategories(categories);
    }

    // Apply rule mappings
    let addedCount = 0;
    for (const m of mappings) {
      if (!m.categoryId || !m.pattern || !m.matchType) continue;
      const cleanPattern = String(m.pattern).trim().toUpperCase();
      if (!cleanPattern) continue;

      const existingIdx = rules.findIndex(
        (r) => r.matchType === m.matchType && String(r.pattern).toUpperCase() === cleanPattern
      );

      const ruleObj = {
        id: existingIdx !== -1 ? rules[existingIdx].id : `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        categoryId: m.categoryId,
        subCategory: m.subCategory || 'Umum',
        matchType: m.matchType, // 'prefix' | 'exact' | 'module'
        pattern: cleanPattern,
        note: m.note || `Dipetakan via Wizard (${m.produk || cleanPattern})`,
      };

      if (existingIdx !== -1) {
        rules[existingIdx] = ruleObj;
      } else {
        rules.unshift(ruleObj);
      }
      addedCount++;
    }

    saveRules(rules);

    const globalUncategorized = getGlobalUncategorizedReport();
    const datesSummary = listAvailableDatesSummary();

    res.json({
      success: true,
      addedCount,
      categories,
      rules,
      globalUncategorized,
      datesSummary,
    });
  } catch (err) {
    console.error('Error in /api/rules/batch-map:', err);
    return safeServerError(res, err);
  }
});

// 6. CRUD for Rules
app.post('/api/rules', (req, res) => {
  try {
    const { categoryId, subCategory, matchType, pattern, note } = req.body;
    if (!categoryId || !matchType || !pattern) {
      return res.status(400).json({ error: 'Kategori, tipe aturan, dan pola wajib diisi.' });
    }
    const rules = getRules();
    const cleanPattern = String(pattern).trim().toUpperCase();
    const newRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      categoryId,
      subCategory: subCategory || 'Umum',
      matchType,
      pattern: cleanPattern,
      note: note || '',
    };
    rules.unshift(newRule);
    saveRules(rules);

    res.json({
      success: true,
      rule: newRule,
      rules,
      globalUncategorized: getGlobalUncategorizedReport(),
      datesSummary: listAvailableDatesSummary(),
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

app.put('/api/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId, subCategory, matchType, pattern, note } = req.body;
    const rules = getRules();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Aturan tidak ditemukan.' });
    }
    rules[idx] = {
      ...rules[idx],
      categoryId: categoryId || rules[idx].categoryId,
      subCategory: subCategory !== undefined ? subCategory : rules[idx].subCategory,
      matchType: matchType || rules[idx].matchType,
      pattern: pattern ? String(pattern).trim().toUpperCase() : rules[idx].pattern,
      note: note !== undefined ? note : rules[idx].note,
    };
    saveRules(rules);

    res.json({
      success: true,
      rules,
      globalUncategorized: getGlobalUncategorizedReport(),
      datesSummary: listAvailableDatesSummary(),
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

app.delete('/api/rules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const rules = getRules().filter((r) => r.id !== id);
    saveRules(rules);

    res.json({
      success: true,
      rules,
      globalUncategorized: getGlobalUncategorizedReport(),
      datesSummary: listAvailableDatesSummary(),
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

// 7. CRUD for Categories
app.post('/api/categories', (req, res) => {
  try {
    const { name, shortName, color, icon, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
    }
    const categories = getCategories();
    const newCat = {
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      shortName: (shortName || name).trim(),
      color: color || '#8b5cf6',
      icon: icon || 'Tag',
      description: description || '',
      order: categories.length + 1,
    };
    categories.push(newCat);
    saveCategories(categories);

    res.json({
      success: true,
      category: newCat,
      categories,
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortName, color, icon, description, order } = req.body;
    const categories = getCategories();
    const idx = categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    }
    categories[idx] = {
      ...categories[idx],
      name: name ? name.trim() : categories[idx].name,
      shortName: shortName ? shortName.trim() : categories[idx].shortName,
      color: color || categories[idx].color,
      icon: icon || categories[idx].icon,
      description: description !== undefined ? description : categories[idx].description,
      order: order !== undefined ? Number(order) : categories[idx].order,
    };
    saveCategories(categories);

    res.json({
      success: true,
      categories,
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const categories = getCategories().filter((c) => c.id !== id);
    const rules = getRules().filter((r) => r.categoryId !== id);
    saveCategories(categories);
    saveRules(rules);

    res.json({
      success: true,
      categories,
      rules,
      globalUncategorized: getGlobalUncategorizedReport(),
      datesSummary: listAvailableDatesSummary(),
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

// 8. Reset Categories & Rules to Default
app.post('/api/settings/reset-defaults', (req, res) => {
  try {
    const { categories, rules } = resetCategoriesAndRulesToDefault();
    res.json({
      success: true,
      categories,
      rules,
      globalUncategorized: getGlobalUncategorizedReport(),
      datesSummary: listAvailableDatesSummary(),
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

// 9. Detected Products Catalog (for quick inspection & override in Settings)
app.get('/api/products/catalog', (req, res) => {
  try {
    const catalog = getDetectedProductsCatalog();
    res.json({ catalog });
  } catch (err) {
    return safeServerError(res, err);
  }
});

// 10. Delete a specific date from local database
app.delete('/api/dates/:date', (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Format tanggal tidak valid (wajib YYYY-MM-DD).' });
    }
    deleteTransactionsForDate(date);
    res.json({
      success: true,
      datesSummary: listAvailableDatesSummary(),
      globalUncategorized: getGlobalUncategorizedReport(),
    });
  } catch (err) {
    return safeServerError(res, err, 'Gagal menghapus data tanggal.');
  }
});

// 11. Transaction Explorer API (Paginated & Filterable)
app.get('/api/transactions', (req, res) => {
  try {
    const {
      date,
      categoryId,
      status,
      search = '',
      page = 1,
      limit = 50,
    } = req.query;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'Format tanggal tidak valid (wajib YYYY-MM-DD).' });
    }

    const targetDates = date ? [String(date)] : null;
    const allTx = getAllTransactionsAcrossDates(targetDates);
    const categories = getCategories();
    const rules = getRules();
    const categoriesMap = new Map(categories.map((c) => [c.id, c]));
    const compiledRules = compileRules(rules);

    const q = String(search).trim().toLowerCase();
    const filtered = [];

    for (const tx of allTx) {
      if (status && status !== 'ALL') {
        if (status === 'GAGAL_ALL' && tx.status === 'Sukses') continue;
        if (status !== 'GAGAL_ALL' && tx.status !== status) continue;
      }
      const ev = evaluateProduct(tx.produk, tx.modul, compiledRules, categoriesMap);
      if (categoryId && categoryId !== 'ALL' && ev.categoryId !== categoryId) continue;

      if (q) {
        const hay = `${tx.produk} ${tx.tujuan} ${tx.reseller} ${tx.modul} ${ev.subCategory}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      filtered.push({
        ...tx,
        categoryId: ev.categoryId,
        categoryName: ev.categoryName,
        subCategory: ev.subCategory,
      });
    }

    filtered.sort((a, b) => String(b.tglEntri).localeCompare(String(a.tglEntri)));

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(10, Math.min(500, parseInt(limit, 10) || 50));
    const startIdx = (pageNum - 1) * limitNum;
    const items = filtered.slice(startIdx, startIdx + limitNum);

    res.json({
      total: filtered.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(filtered.length / limitNum),
      items,
    });
  } catch (err) {
    return safeServerError(res, err);
  }
});

// 12. Download bundled sample Excel files (disabled in production unless ENABLE_DEMO_TOOLS=true)
app.get('/api/sample-files/:name', (req, res) => {
  if (!ENABLE_DEMO_TOOLS) {
    return res.status(403).json({
      error: 'Fitur simulasi/sampel dinonaktifkan di mode produksi.',
    });
  }
  const safeName = path.basename(req.params.name);
  const filePath = path.join(process.cwd(), 'sample-data', safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File sampel tidak ditemukan.' });
  }
  res.download(filePath, safeName);
});

// Serve frontend build in production
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    return res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });
}

// Global error handler (handles CORS/Multer/unexpected errors cleanly without leaking stack traces)
app.use((err, req, res, next) => {
  if (err?.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Ukuran file melebihi batas maksimal 25 MB.' });
  }
  if (err?.message?.includes('Format file ditolak')) {
    return res.status(400).json({ error: err.message });
  }
  return safeServerError(res, err);
});

async function startServer() {
  ensureAuthInitialized();
  await ensureSeedDataIfEmpty();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 AnalisaOto Server (ZimaOS Private Edition) running on port ${PORT}`);
    console.log(`🔒 Security Gate: Auth + Helmet + Strict CORS + Rate Limiting ACTIVE`);
    console.log(`📁 Persistent Data Volume: ${process.env.DATA_DIR || path.join(process.cwd(), 'data')}`);
    console.log(`================================================================`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

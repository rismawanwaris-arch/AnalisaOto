import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  BookOpen,
  FolderPlus,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Search,
  Check,
  X,
  Tag,
  Sparkles,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { formatRupiah, formatNumber } from '../utils/format.js';
import { apiFetch } from '../utils/api.js';

export default function RulesSettingsView({
  categories = [],
  rules = [],
  onRefreshBootstrap,
  onOpenWizard,
  uncategorizedCount = 0,
}) {
  const [subTab, setSubTab] = useState('rules'); // 'rules' | 'products' | 'categories'
  const [filterCatId, setFilterCatId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Rule Form State
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    categoryId: categories[0]?.id || 'cat_transfer_bank',
    subCategory: '',
    matchType: 'prefix',
    pattern: '',
    note: '',
  });

  // Category Form State
  const [editingCatId, setEditingCatId] = useState(null);
  const [catForm, setCatForm] = useState({
    name: '',
    shortName: '',
    color: '#6366f1',
    description: '',
  });

  // Detected Products Catalog
  const [productCatalog, setProductCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [overrideModalProduct, setOverrideModalProduct] = useState(null);
  const [overrideCatId, setOverrideCatId] = useState('');
  const [overrideSubCat, setOverrideSubCat] = useState('');
  const [overrideMatchType, setOverrideMatchType] = useState('exact');
  const [overridePattern, setOverridePattern] = useState('');

  const loadProductCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const res = await apiFetch('/api/products/catalog');
      if (res.status === 401) return;
      const data = await res.json();
      setProductCatalog(data.catalog || []);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (subTab === 'products') {
      loadProductCatalog();
    }
  }, [subTab, rules, categories]);

  const categoriesMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rules.filter((r) => {
      if (filterCatId !== 'ALL' && r.categoryId !== filterCatId) return false;
      if (q) {
        const catName = categoriesMap.get(r.categoryId)?.name || '';
        const hay = `${r.pattern} ${r.subCategory} ${r.note} ${catName} ${r.matchType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rules, filterCatId, searchQuery, categoriesMap]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return productCatalog.filter((p) => {
      if (filterCatId !== 'ALL' && p.categoryId !== filterCatId) return false;
      if (q) {
        const hay = `${p.produk} ${p.modul} ${p.categoryName} ${p.subCategory}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [productCatalog, filterCatId, searchQuery]);

  // Handlers for Rules CRUD
  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.pattern.trim()) return;

    const url = editingRuleId ? `/api/rules/${editingRuleId}` : '/api/rules';
    const method = editingRuleId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruleForm),
    });

    if (res.ok) {
      setEditingRuleId(null);
      setRuleForm({
        categoryId: categories[0]?.id || 'cat_transfer_bank',
        subCategory: '',
        matchType: 'prefix',
        pattern: '',
        note: '',
      });
      await onRefreshBootstrap();
    }
  };

  const handleEditRuleClick = (rule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      categoryId: rule.categoryId,
      subCategory: rule.subCategory || '',
      matchType: rule.matchType,
      pattern: rule.pattern,
      note: rule.note || '',
    });
  };

  const handleDeleteRule = async (id) => {
    const res = await apiFetch(`/api/rules/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await onRefreshBootstrap();
    }
  };

  // Handlers for Categories CRUD
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;

    const url = editingCatId ? `/api/categories/${editingCatId}` : '/api/categories';
    const method = editingCatId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catForm),
    });

    if (res.ok) {
      setEditingCatId(null);
      setCatForm({ name: '', shortName: '', color: '#8b5cf6', description: '' });
      await onRefreshBootstrap();
    }
  };

  const handleDeleteCategory = async (id) => {
    if (categories.length <= 1) return;
    const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await onRefreshBootstrap();
    }
  };

  const handleResetDefaults = async () => {
    const res = await apiFetch('/api/settings/reset-defaults', { method: 'POST' });
    if (res.ok) {
      await onRefreshBootstrap();
      if (subTab === 'products') loadProductCatalog();
    }
  };

  const openProductOverrideModal = (prodItem) => {
    setOverrideModalProduct(prodItem);
    setOverrideCatId(
      prodItem.categoryId !== 'uncategorized'
        ? prodItem.categoryId
        : categories[0]?.id || 'cat_pulsa_data'
    );
    setOverrideSubCat(prodItem.subCategory || 'Umum');
    setOverrideMatchType('exact');
    setOverridePattern(prodItem.produk);
  };

  const handleSaveProductOverride = async (e) => {
    e.preventDefault();
    if (!overrideModalProduct) return;
    const res = await apiFetch('/api/rules/batch-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mappings: [
          {
            produk: overrideModalProduct.produk,
            categoryId: overrideCatId,
            subCategory: overrideSubCat || 'Umum',
            matchType: overrideMatchType,
            pattern: overridePattern.trim().toUpperCase(),
            note: `Re-klasifikasi manual produk ${overrideModalProduct.produk}`,
          },
        ],
      }),
    });
    if (res.ok) {
      setOverrideModalProduct(null);
      await onRefreshBootstrap();
      loadProductCatalog();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Header & Navigation Tabs */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Pengaturan Kategori & Kamus Aturan Produk (Modular Rules Engine)
              </h2>
              <p className="text-xs text-slate-400">
                Kelola 5 Pilar Kategori, tambahkan kategori baru, edit pola Prefix/Exact/Modul, atau ubah klasifikasi produk tertentu secara instan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {uncategorizedCount > 0 && (
              <button
                type="button"
                onClick={onOpenWizard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow"
              >
                <AlertTriangle className="w-4 h-4" />
                Petakan {uncategorizedCount} Produk Baru
              </button>
            )}
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
              title="Kembalikan kategori dan kamus aturan ke standar bawaan aplikasi"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              Reset to Default
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setSubTab('rules')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                subTab === 'rules'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Kamus Aturan Aktif ({rules.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('products')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                subTab === 'products'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              Inspeksi & Ubah Kategori per Produk
            </button>
            <button
              type="button"
              onClick={() => setSubTab('categories')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                subTab === 'categories'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderPlus className="w-4 h-4" />
              Manajemen Kategori Pilar ({categories.length})
            </button>
          </div>

          {subTab !== 'categories' && (
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={filterCatId}
                onChange={(e) => setFilterCatId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">Semua Kategori ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="uncategorized">[Belum Dikategorikan]</option>
              </select>

              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode, prefix, bank, modul..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: KAMUS ATURAN AKTIF (CRUD RULES) */}
      {subTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Tambah / Edit Aturan (4 Cols) */}
          <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              {editingRuleId ? (
                <>
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  Edit Aturan Kategori
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Tambah Aturan Baru ke Kamus
                </>
              )}
            </h3>

            <form onSubmit={handleSaveRule} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Pilih Kategori Tujuan
                </label>
                <select
                  value={ruleForm.categoryId}
                  onChange={(e) => setRuleForm({ ...ruleForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Metode Pencocokan (Rule Matching)
                </label>
                <select
                  value={ruleForm.matchType}
                  onChange={(e) => setRuleForm({ ...ruleForm, matchType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-semibold focus:border-indigo-500 focus:outline-none"
                >
                  <option value="prefix">Prefix / Awalan Kode Produk (Direkomendasikan)</option>
                  <option value="exact">Nama Persis (Exact Match Kode Produk)</option>
                  <option value="module">Berdasarkan Modul Supplier</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {ruleForm.matchType === 'prefix'
                    ? 'Pola Awalan / Prefix (Contoh: TBCA, DANA, MAXD)'
                    : ruleForm.matchType === 'exact'
                    ? 'Kode Produk Persis (Contoh: TDOQR, MAXD10)'
                    : 'Nama Modul Supplier (Contoh: VOUCHER, INJECT VC)'}
                </label>
                <input
                  type="text"
                  value={ruleForm.pattern}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, pattern: e.target.value.toUpperCase() })
                  }
                  placeholder="Masukkan pola kode..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono font-bold text-indigo-300 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Label Sub-Kategori / Grup Drill-Down
                </label>
                <input
                  type="text"
                  value={ruleForm.subCategory}
                  onChange={(e) => setRuleForm({ ...ruleForm, subCategory: e.target.value })}
                  placeholder="Contoh: Bank BCA, DANA, Telkomsel, Token PLN"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={ruleForm.note}
                  onChange={(e) => setRuleForm({ ...ruleForm, note: e.target.value })}
                  placeholder="Keterangan aturan..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                >
                  {editingRuleId ? 'Simpan Perubahan Aturan' : 'Tambahkan & Hitung Ulang'}
                </button>
                {editingRuleId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRuleId(null);
                      setRuleForm({
                        categoryId: categories[0]?.id || 'cat_transfer_bank',
                        subCategory: '',
                        matchType: 'prefix',
                        pattern: '',
                        note: '',
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Tabel Daftar Aturan (8 Cols) */}
          <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="max-h-[640px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="py-3.5 px-4">Pola Aturan</th>
                    <th className="py-3.5 px-3">Tipe Pencocokan</th>
                    <th className="py-3.5 px-4">Kategori Pilar</th>
                    <th className="py-3.5 px-3">Sub-Kategori (Drilldown)</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredRules.map((rule) => {
                    const cat = categoriesMap.get(rule.categoryId);
                    return (
                      <tr key={rule.id} className="hover:bg-slate-950/60">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-sm text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md inline-block">
                            {rule.matchType === 'prefix' ? `${rule.pattern}*` : rule.pattern}
                          </span>
                          {rule.note && (
                            <div className="text-[11px] text-slate-500 mt-1">{rule.note}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              rule.matchType === 'prefix'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : rule.matchType === 'exact'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {rule.matchType === 'prefix'
                              ? 'Prefix / Awalan'
                              : rule.matchType === 'exact'
                              ? 'Exact Match'
                              : 'Modul Supplier'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat?.color || '#6366f1' }}
                            />
                            <span className="font-semibold text-white">
                              {cat?.shortName || cat?.name || rule.categoryId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {rule.subCategory || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditRuleClick(rule)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Edit Aturan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                              title="Hapus Aturan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INSPEKSI & UBAH KATEGORI PER PRODUK TERDETEKSI */}
      {subTab === 'products' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Menampilkan <strong className="text-white">{filteredCatalog.length} kode produk</strong> yang terdeteksi di
              database lokal. Klik <strong>"Ubah Kategori"</strong> jika ada produk yang ingin dipindahkan ke kategori lain.
            </span>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="py-3.5 px-4">Kode Produk</th>
                  <th className="py-3.5 px-3">Modul Supplier</th>
                  <th className="py-3.5 px-3 text-right">Frekuensi Trx</th>
                  <th className="py-3.5 px-4 text-right">Total Omset</th>
                  <th className="py-3.5 px-4">Kategori Saat Ini</th>
                  <th className="py-3.5 px-3">Sub-Kategori</th>
                  <th className="py-3.5 px-3">Aturan Penangkap</th>
                  <th className="py-3.5 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loadingCatalog ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Memuat katalog produk...
                    </td>
                  </tr>
                ) : (
                  filteredCatalog.map((item) => {
                    const cat = categoriesMap.get(item.categoryId);
                    return (
                      <tr key={item.produk} className="hover:bg-slate-950/60">
                        <td className="py-3 px-4 font-mono font-bold text-sm text-white">
                          {item.produk}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{item.modul}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-200">
                          {formatNumber(item.frequency)}x
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          {formatRupiah(item.totalOmset)}
                        </td>
                        <td className="py-3 px-4">
                          {item.isCategorized ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: cat?.color || '#6366f1' }}
                              />
                              {cat?.shortName || item.categoryName}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                              [Belum Dikategorikan]
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{item.subCategory}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-indigo-300">
                          {item.matchedRulePattern}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openProductOverrideModal(item)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold transition-colors"
                          >
                            Ubah Kategori
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MANAJEMEN KATEGORI PILAR */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <FolderPlus className="w-4 h-4 text-indigo-400" />
              {editingCatId ? 'Edit Kategori Pilar' : 'Tambah Kategori Kustom Baru'}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nama Kategori Lengkap
                </label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="Contoh: Topup Game & Voucher Digital"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nama Singkat (Untuk Laporan WA & Grafik)
                </label>
                <input
                  type="text"
                  value={catForm.shortName}
                  onChange={(e) => setCatForm({ ...catForm, shortName: e.target.value })}
                  placeholder="Contoh: Topup Game"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Warna Indikator Visual
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={catForm.color}
                    onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                    className="h-9 w-16 rounded-lg bg-slate-950 border border-slate-800 p-1 cursor-pointer"
                  />
                  <span className="font-mono text-slate-400">{catForm.color}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Deskripsi Kategori
                </label>
                <textarea
                  rows={3}
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Penjelasan jenis produk dalam kategori ini..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                >
                  {editingCatId ? 'Simpan Perubahan Kategori' : 'Tambah Kategori Baru'}
                </button>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatForm({ name: '', shortName: '', color: '#6366f1', description: '' });
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-8 space-y-3">
            {categories.map((cat) => {
              const catRulesCount = rules.filter((r) => r.categoryId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 max-w-xl">
                    <span
                      className="w-4 h-10 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                          {catRulesCount} aturan aktif
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{cat.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setCatForm({
                          name: cat.name,
                          shortName: cat.shortName || cat.name,
                          color: cat.color || '#6366f1',
                          description: cat.description || '',
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Ubah Nama / Warna
                    </button>
                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Override Kategori Produk Spesifik */}
      {overrideModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                Ubah Kategori Produk:{' '}
                <span className="font-mono text-indigo-400">{overrideModalProduct.produk}</span>
              </h3>
              <button
                onClick={() => setOverrideModalProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductOverride} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Pindahkan ke Kategori:
                </label>
                <select
                  value={overrideCatId}
                  onChange={(e) => setOverrideCatId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Cakupan Aturan:
                </label>
                <select
                  value={overrideMatchType}
                  onChange={(e) => {
                    const mt = e.target.value;
                    setOverrideMatchType(mt);
                    if (mt === 'exact') {
                      setOverridePattern(overrideModalProduct.produk);
                    } else if (mt === 'prefix') {
                      setOverridePattern(
                        overrideModalProduct.produk.replace(/[0-9]+.*$/, '') ||
                          overrideModalProduct.produk
                      );
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-semibold"
                >
                  <option value="exact">Hanya Kode Persis ({overrideModalProduct.produk})</option>
                  <option value="prefix">Seluruh Produk Berawalan (Prefix)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Pola Kode:</label>
                <input
                  type="text"
                  value={overridePattern}
                  onChange={(e) => setOverridePattern(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-indigo-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Sub-Kategori (Misal: Bank BCA, DANA, Telkomsel):
                </label>
                <input
                  type="text"
                  value={overrideSubCat}
                  onChange={(e) => setOverrideSubCat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Simpan & Hitung Ulang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

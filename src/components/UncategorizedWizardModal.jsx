import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Wand2,
  CheckCircle2,
  Plus,
  X,
  Sparkles,
  Layers,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { formatRupiah, formatNumber } from '../utils/format.js';
import { sortArray, toggleSortConfig } from '../utils/sort.js';
import SortableTh from './SortableTh.jsx';

export default function UncategorizedWizardModal({
  isOpen,
  onClose,
  uncategorizedReport,
  categories,
  onApplyMappings,
}) {
  const items = uncategorizedReport?.items || [];
  const [rowsState, setRowsState] = useState([]);
  const [wizardSort, setWizardSort] = useState({ key: 'frequency', dir: 'desc' });
  const [localCategories, setLocalCategories] = useState([]);
  const [newCategories, setNewCategories] = useState([]);
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatShort, setNewCatShort] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8b5cf6');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLocalCategories(categories || []);
  }, [categories]);

  useEffect(() => {
    if (!items || items.length === 0) {
      setRowsState([]);
      return;
    }
    setRowsState(
      items.map((item) => ({
        produk: item.produk,
        sampleTujuan: item.sampleTujuan,
        frequency: item.frequency,
        totalOmset: item.totalOmset,
        modul: item.modul,
        categoryId: item.suggestedCategoryId || categories?.[0]?.id || 'cat_pulsa_data',
        matchType: item.suggestedMatchType || 'prefix',
        pattern:
          item.suggestedMatchType === 'module'
            ? item.modul
            : item.suggestedMatchType === 'exact'
            ? item.produk
            : item.suggestedPrefix || item.produk.slice(0, 4),
        subCategory: item.suggestedSubCategory || 'Umum',
        enabled: true,
      }))
    );
  }, [items, categories]);

  // Calculate deduplicated rules preview so user sees when 1 prefix rule covers multiple new products
  const deduplicatedRulesSummary = useMemo(() => {
    const map = new Map();
    for (const r of rowsState) {
      if (!r.enabled || !r.pattern) continue;
      const key = `${r.matchType}:${String(r.pattern).toUpperCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          ...r,
          coveredProducts: [r.produk],
          totalFreq: r.frequency,
        });
      } else {
        const entry = map.get(key);
        entry.coveredProducts.push(r.produk);
        entry.totalFreq += r.frequency;
      }
    }
    return Array.from(map.values());
  }, [rowsState]);

  const sortedRows = useMemo(
    () => sortArray(rowsState, wizardSort),
    [rowsState, wizardSort]
  );

  if (!isOpen) return null;

  const handleRowChange = (produk, field, value) => {
    setRowsState((prev) =>
      prev.map((row) => {
        if (row.produk !== produk) return row;
        const current = { ...row, [field]: value };

        if (field === 'matchType') {
          const sourceItem = items.find((it) => it.produk === produk);
          if (value === 'prefix') {
            current.pattern =
              sourceItem?.suggestedPrefix ||
              current.produk.replace(/[0-9]+.*$/, '') ||
              current.produk;
          } else if (value === 'exact') {
            current.pattern = current.produk;
          } else if (value === 'module') {
            current.pattern = current.modul;
          }
        }

        return current;
      })
    );
  };

  const handleCreateLocalCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat = {
      id: `cat_custom_${Date.now()}`,
      name: newCatName.trim(),
      shortName: (newCatShort || newCatName).trim(),
      color: newCatColor,
      icon: 'Tag',
      description: 'Kategori kustom ditambahkan via Wizard Pemetaan',
    };
    setLocalCategories((prev) => [...prev, newCat]);
    setNewCategories((prev) => [...prev, newCat]);
    setNewCatName('');
    setNewCatShort('');
    setShowNewCatForm(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const mappings = deduplicatedRulesSummary.map((r) => ({
        produk: r.coveredProducts.join(', '),
        categoryId: r.categoryId,
        subCategory: r.subCategory,
        matchType: r.matchType,
        pattern: String(r.pattern).trim().toUpperCase(),
        note: `Wizard Pemetaan (${r.coveredProducts.join(', ')})`,
      }));
      await onApplyMappings({ mappings, newCategories });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-950/30 overflow-hidden my-8 animate-scale-in">
        {/* Top Warning Banner Strip */}
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 border-b border-amber-500/30 px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Uncategorized Interceptor & Mapping Wizard
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Safe Staging Aktif
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1.5">
                Panduan Pemetaan Kategori Produk Baru (Interactive Mapping Guide)
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Perhatian: Ditemukan{' '}
                <span className="font-bold text-amber-300">
                  {uncategorizedReport?.uncategorizedProductCount || 0} jenis produk baru
                </span>{' '}
                (total{' '}
                <span className="font-bold text-amber-300">
                  {formatNumber(uncategorizedReport?.totalUncategorizedTrx || 0)} transaksi
                </span>{' '}
                senilai{' '}
                <span className="font-bold text-amber-300">
                  {formatRupiah(uncategorizedReport?.totalUncategorizedOmset || 0)}
                </span>
                ) yang belum memiliki aturan di Kamus Kategori. Data telah disimpan aman dengan label sementara{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-xs">[Belum Dikategorikan]</code>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup sementara (Data tetap aman di Staging)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: Add Custom Category */}
        <div className="px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Sistem telah menyarankan <strong>Kategori</strong> dan <strong>Pola Prefix</strong> secara cerdas. Anda
              dapat menyesuaikan sebelum menyimpan ke Kamus Aturan Lokal.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowNewCatForm(!showNewCatForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Buat Kategori Baru (Misal: Topup Game / Pajak)
          </button>
        </div>

        {/* Inline New Category Creator */}
        {showNewCatForm && (
          <form
            onSubmit={handleCreateLocalCategory}
            className="px-6 py-4 bg-indigo-950/30 border-b border-indigo-500/30 flex flex-wrap items-end gap-3 animate-fade-in"
          >
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-indigo-200 mb-1">Nama Kategori Lengkap</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Contoh: Topup Game & Voucher Digital"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-medium text-indigo-200 mb-1">Nama Singkat (WA/Tabel)</label>
              <input
                type="text"
                value={newCatShort}
                onChange={(e) => setNewCatShort(e.target.value)}
                placeholder="Contoh: Topup Game"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-200 mb-1">Warna</label>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="h-9 w-14 rounded-lg bg-slate-900 border border-slate-700 p-1 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              Tambahkan ke Pilihan Kategori
            </button>
            <button
              type="button"
              onClick={() => setShowNewCatForm(false)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Batal
            </button>
          </form>
        )}

        {/* Mapping Table */}
        <div className="max-h-[55vh] overflow-y-auto">
          {rowsState.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">Seluruh Produk Telah Terkategorisasi!</h3>
              <p className="text-sm text-slate-400 mt-1">
                Tidak ada produk yang belum memiliki aturan di Kamus Kategori saat ini.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950/90 sticky top-0 z-10 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <SortableTh
                    label="Kode Produk Baru"
                    sortKey="produk"
                    sortConfig={wizardSort}
                    onSort={(k, d) => setWizardSort((prev) => toggleSortConfig(prev, k, d))}
                    defaultDir="asc"
                    className="py-3.5 px-4"
                  />
                  <SortableTh
                    label="Sampel Tujuan"
                    sortKey="sampleTujuan"
                    sortConfig={wizardSort}
                    onSort={(k, d) => setWizardSort((prev) => toggleSortConfig(prev, k, d))}
                    defaultDir="asc"
                    className="py-3.5 px-3"
                  />
                  <SortableTh
                    label="Frekuensi"
                    sortKey="frequency"
                    sortConfig={wizardSort}
                    onSort={(k, d) => setWizardSort((prev) => toggleSortConfig(prev, k, d))}
                    align="center"
                    className="py-3.5 px-3"
                  />
                  <SortableTh
                    label="Modul Supplier"
                    sortKey="modul"
                    sortConfig={wizardSort}
                    onSort={(k, d) => setWizardSort((prev) => toggleSortConfig(prev, k, d))}
                    defaultDir="asc"
                    className="py-3.5 px-3"
                  />
                  <th className="py-3.5 px-4">Tindakan Pemetaan (Kategori & Pola Aturan)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-sm">
                {sortedRows.map((row) => (
                  <tr
                    key={row.produk}
                    className={`transition-colors ${
                      row.enabled ? 'bg-slate-900/40 hover:bg-slate-800/40' : 'bg-slate-950/50 opacity-50'
                    }`}
                  >
                    {/* Kode Produk Baru */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => handleRowChange(row.produk, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 bg-slate-800"
                        />
                        <div>
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md inline-block">
                            {row.produk}
                          </span>
                          <div className="text-xs text-slate-400 mt-1 tabular-nums">
                            Omset: {formatRupiah(row.totalOmset)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sampel Tujuan */}
                    <td className="py-3.5 px-3 align-top font-mono text-xs text-slate-300">
                      <div className="bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800 inline-block">
                        {row.sampleTujuan}
                      </div>
                    </td>

                    {/* Frekuensi */}
                    <td className="py-3.5 px-3 align-top text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-white border border-slate-700 tabular-nums">
                        {row.frequency}x
                      </span>
                    </td>

                    {/* Modul Supplier */}
                    <td className="py-3.5 px-3 align-top">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                        {row.modul}
                      </span>
                    </td>

                    {/* Tindakan Pemetaan */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
                        {/* Pilih Kategori */}
                        <div className="lg:col-span-5">
                          <label className="block text-[11px] text-slate-400 mb-1">Pilih Kategori Pilar:</label>
                          <select
                            value={row.categoryId}
                            onChange={(e) => handleRowChange(row.produk, 'categoryId', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-medium text-white focus:border-indigo-500 focus:outline-none"
                          >
                            {localCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Pilih Tipe Aturan */}
                        <div className="lg:col-span-3">
                          <label className="block text-[11px] text-slate-400 mb-1">Metode Pencocokan:</label>
                          <select
                            value={row.matchType}
                            onChange={(e) => handleRowChange(row.produk, 'matchType', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-medium text-emerald-300 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="prefix">Prefix / Awalan ★</option>
                            <option value="exact">Nama Persis (Exact)</option>
                            <option value="module">Modul Supplier</option>
                          </select>
                        </div>

                        {/* Pola Aturan (Prefix/Exact/Module) */}
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            {row.matchType === 'prefix'
                              ? 'Pola Awalan:'
                              : row.matchType === 'exact'
                              ? 'Kode Persis:'
                              : 'Nama Modul:'}
                          </label>
                          <input
                            type="text"
                            value={row.pattern}
                            onChange={(e) => handleRowChange(row.produk, 'pattern', e.target.value.toUpperCase())}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-indigo-500/50 text-xs font-mono font-bold text-indigo-300 focus:border-indigo-400 focus:outline-none"
                          />
                        </div>

                        {/* Sub-Kategori / Grup Drilldown */}
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] text-slate-400 mb-1">Sub-Grup Tabel:</label>
                          <input
                            type="text"
                            value={row.subCategory}
                            onChange={(e) => handleRowChange(row.produk, 'subCategory', e.target.value)}
                            placeholder="Sub-kategori"
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Summary & Instant Recalculation Button */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Akan menyimpan <strong className="text-white">{deduplicatedRulesSummary.length} aturan baru</strong> ke
              Kamus Aturan Lokal ZimaOS dan menghitung ulang seluruh metrik secara instan.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Nanti Saja (Simpan Sementara)
            </button>
            {rowsState.length > 0 && (
              <button
                type="button"
                disabled={isSubmitting || deduplicatedRulesSummary.length === 0}
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Menyimpan & Menghitung Ulang...' : 'Terapkan & Simpan Aturan'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

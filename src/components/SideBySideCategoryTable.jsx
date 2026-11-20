import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronsUpDown,
  Package,
  Search,
  Filter,
} from 'lucide-react';
import { formatRupiah, formatCompactRupiah, formatNumber, formatPercent } from '../utils/format.js';

export default function SideBySideCategoryTable({
  categoryComparison = [],
  period = {},
  kpi = {},
  initialCategoryId = 'ALL',
}) {
  const [selectedCatFilter, setSelectedCatFilter] = useState(initialCategoryId || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState({
    cat_transfer_bank: true,
    cat_ewallet: true,
    cat_ppob: true,
    cat_voucher: true,
    cat_pulsa_data: true,
  });
  const [expandedSubs, setExpandedSubs] = useState({});

  useEffect(() => {
    if (initialCategoryId) {
      setSelectedCatFilter(initialCategoryId);
    }
  }, [initialCategoryId]);

  const activeCategoryObj = useMemo(
    () => categoryComparison.find((c) => c.categoryId === selectedCatFilter) || null,
    [categoryComparison, selectedCatFilter]
  );

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categoryComparison
      .filter((c) => selectedCatFilter === 'ALL' || c.categoryId === selectedCatFilter)
      .map((c) => {
        if (!q) return c;
        const matchedSubs = (c.subCategories || [])
          .map((sub) => {
            const subMatches = sub.name.toLowerCase().includes(q);
            const matchedProds = (sub.products || []).filter((p) =>
              p.produk.toLowerCase().includes(q)
            );
            if (subMatches) return sub;
            if (matchedProds.length > 0) return { ...sub, products: matchedProds };
            return null;
          })
          .filter(Boolean);
        return { ...c, subCategories: matchedSubs };
      })
      .filter((c) => !q || (c.subCategories && c.subCategories.length > 0));
  }, [categoryComparison, selectedCatFilter, searchQuery]);

  const toggleCategory = (catId) => {
    setExpandedCats((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const toggleSubCategory = (catId, subName, e) => {
    if (e) e.stopPropagation();
    const key = `${catId}::${subName}`;
    setExpandedSubs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAll = () => {
    const allCats = {};
    const allSubs = {};
    for (const c of categoryComparison) {
      allCats[c.categoryId] = true;
      for (const s of c.subCategories || []) {
        allSubs[`${c.categoryId}::${s.name}`] = true;
      }
    }
    setExpandedCats(allCats);
    setExpandedSubs(allSubs);
  };

  const collapseAll = () => {
    setExpandedCats({});
    setExpandedSubs({});
  };

  const renderTrendBadge = (trend, pct) => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <TrendingUp className="w-3.5 h-3.5" />
          Naik ({formatPercent(pct)})
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <TrendingDown className="w-3.5 h-3.5" />
          Turun ({formatPercent(pct)})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <Minus className="w-3.5 h-3.5" />
        Stabil (0%)
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 1. Menu Kartu Pilihan 5 Pilar Kategori Produk */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              Pilih Kategori Produk yang Ingin Dianalisa
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik salah satu kartu kategori di bawah untuk fokus menganalisa Bank / E-Wallet / Operator di dalam kategori tersebut.
            </p>
          </div>
          {selectedCatFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedCatFilter('ALL')}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-all"
            >
              Tampilkan Semua 5 Kategori
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Tombol Semua Kategori */}
          <button
            type="button"
            onClick={() => setSelectedCatFilter('ALL')}
            className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
              selectedCatFilter === 'ALL'
                ? 'bg-indigo-600/20 border-indigo-400 ring-1 ring-indigo-500/40 shadow-lg'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                SEMUA KATEGORI
              </div>
              <div className="text-sm font-extrabold text-white mt-1">
                5 Pilar Produk
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80">
              <div className="text-xs font-bold text-emerald-400 tabular-nums">
                {formatCompactRupiah(kpi?.omset?.d1 || 0)}
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                {formatNumber(kpi?.transaksiSukses?.d1 || 0)} Trx Sukses
              </div>
            </div>
          </button>

          {/* 5 Kartu Kategori */}
          {categoryComparison.map((cat) => {
            const isSelected = selectedCatFilter === cat.categoryId;
            return (
              <button
                key={cat.categoryId}
                type="button"
                onClick={() =>
                  setSelectedCatFilter(isSelected ? 'ALL' : cat.categoryId)
                }
                className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-800/90 border-indigo-400 ring-1 ring-indigo-500/40 shadow-lg'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-300">
                      {cat.shareD1Pct}% Server
                    </span>
                  </div>
                  <div className="text-xs font-extrabold text-white mt-1.5 line-clamp-1">
                    {cat.shortName}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 tabular-nums">
                  <div className="text-xs font-extrabold text-white">
                    {formatCompactRupiah(cat.omsetD1)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-0.5">
                    <span className="text-slate-400">{formatNumber(cat.trxD1)} Trx</span>
                    <span
                      className={`font-bold ${
                        cat.selisihRp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPercent(cat.selisihPct)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Jika 1 Kategori Dipilih, Tampilkan Kartu Sub-Kategori (Bank / E-Wallet / Operator) agar Sangat Mudah Dibaca */}
      {activeCategoryObj && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 shadow-xl animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: activeCategoryObj.color }}
              />
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Ringkasan Sub-Kategori di dalam {activeCategoryObj.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Total Omset D1: <strong className="text-white">{formatRupiah(activeCategoryObj.omsetD1)}</strong> ({formatNumber(activeCategoryObj.trxD1)} Trx) vs D2: <strong className="text-slate-300">{formatRupiah(activeCategoryObj.omsetD2)}</strong> ({formatNumber(activeCategoryObj.trxD2)} Trx)
                </p>
              </div>
            </div>
            {renderTrendBadge(activeCategoryObj.trend, activeCategoryObj.selisihPct)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {(activeCategoryObj.subCategories || []).map((sub) => (
              <div
                key={sub.name}
                onClick={(e) => toggleSubCategory(activeCategoryObj.categoryId, sub.name, e)}
                className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all tabular-nums"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{sub.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                    {sub.shareOfCatPct}%
                  </span>
                </div>
                <div className="text-sm font-extrabold text-white mt-2">
                  {formatRupiah(sub.omsetD1)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>{formatNumber(sub.trxD1)} Trx (D2: {formatNumber(sub.trxD2)})</span>
                  <span
                    className={`font-bold ${
                      sub.selisihRp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatPercent(sub.selisihPct)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Tabel Komparasi Detail (Kategori -> Sub-Kategori -> Kode Produk) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Tabel Rincian Kategori → Sub-Kategori → Kode Produk
              </h3>
              <p className="text-xs text-slate-400">
                Klik baris Sub-Kategori (misal: Bank BCA, DANA, Token PLN) untuk melihat rincian per Kode Produk.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-60">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Bank / E-Wallet / Kode (TBCA, DANA)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-indigo-400" />
              Buka Semua Produk
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-xs font-medium text-slate-400 border border-slate-800 transition-colors"
            >
              Tutup Semua
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5 min-w-[260px]">Kategori / Sub-Kategori / Produk</th>
                <th className="py-3.5 px-4 text-right">Omset D1 ({period?.d1Label})</th>
                <th className="py-3.5 px-4 text-right">Omset D2 ({period?.d2Label})</th>
                <th className="py-3.5 px-4 text-right">Selisih (Rp)</th>
                <th className="py-3.5 px-3 text-right">Selisih (%)</th>
                <th className="py-3.5 px-3 text-right">Trx D1</th>
                <th className="py-3.5 px-3 text-right">Trx D2</th>
                <th className="py-3.5 px-3 text-right">Laba D1</th>
                <th className="py-3.5 px-4 text-center">Tren</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 text-sm tabular-nums">
              {filteredCategories.map((cat) => {
                const isExpanded = !!expandedCats[cat.categoryId];
                const isPositive = cat.selisihRp >= 0;

                return (
                  <React.Fragment key={cat.categoryId}>
                    {/* Level 1: Category Row */}
                    <tr
                      onClick={() => toggleCategory(cat.categoryId)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded
                          ? 'bg-slate-800/70 hover:bg-slate-800'
                          : 'bg-slate-900/50 hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <span className="p-1 rounded-md bg-slate-950/80 border border-slate-700 text-slate-300">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow"
                            style={{ backgroundColor: cat.color || '#6366f1' }}
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{cat.name}</span>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                                {cat.subCategories?.length || 0} sub-kategori
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Kontribusi Omset D1: <strong className="text-slate-300">{cat.shareD1Pct}%</strong>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-right font-bold text-white">
                        {formatRupiah(cat.omsetD1)}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-300">
                        {formatRupiah(cat.omsetD2)}
                      </td>
                      <td
                        className={`py-4 px-4 text-right font-bold ${
                          cat.selisihRp > 0
                            ? 'text-emerald-400'
                            : cat.selisihRp < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {isPositive && cat.selisihRp > 0 ? '+' : ''}
                        {formatRupiah(cat.selisihRp)}
                      </td>
                      <td
                        className={`py-4 px-3 text-right font-bold ${
                          cat.selisihPct > 0
                            ? 'text-emerald-400'
                            : cat.selisihPct < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {formatPercent(cat.selisihPct)}
                      </td>
                      <td className="py-4 px-3 text-right font-semibold text-white">
                        {formatNumber(cat.trxD1)}
                      </td>
                      <td className="py-4 px-3 text-right text-slate-400">
                        {formatNumber(cat.trxD2)}
                      </td>
                      <td className="py-4 px-3 text-right font-medium text-indigo-300">
                        {formatRupiah(cat.labaD1)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {renderTrendBadge(cat.trend, cat.selisihPct)}
                      </td>
                    </tr>

                    {/* Level 2: Sub-Category Rows (BCA, BRI, Mandiri, DANA, GoPay, etc.) */}
                    {isExpanded &&
                      cat.subCategories?.map((sub) => {
                        const subKey = `${cat.categoryId}::${sub.name}`;
                        const isSubExpanded = !!expandedSubs[subKey];

                        return (
                          <React.Fragment key={subKey}>
                            <tr
                              onClick={(e) => toggleSubCategory(cat.categoryId, sub.name, e)}
                              className="bg-slate-950/75 hover:bg-slate-900/90 cursor-pointer border-l-4 transition-colors animate-fade-in"
                              style={{ borderLeftColor: cat.color || '#6366f1' }}
                            >
                              <td className="py-3 pl-12 pr-4">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-slate-400">
                                    {isSubExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </span>
                                  <div>
                                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                                      <span>{sub.name}</span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                        {sub.products?.length || 0} kode produk
                                      </span>
                                    </div>
                                    <div className="w-32 h-1 bg-slate-900 rounded-full overflow-hidden mt-1">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${Math.max(3, sub.shareOfCatPct)}%`,
                                          backgroundColor: cat.color || '#6366f1',
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right text-xs font-semibold text-slate-100">
                                {formatRupiah(sub.omsetD1)}
                              </td>
                              <td className="py-3 px-4 text-right text-xs text-slate-400">
                                {formatRupiah(sub.omsetD2)}
                              </td>
                              <td
                                className={`py-3 px-4 text-right text-xs font-semibold ${
                                  sub.selisihRp > 0
                                    ? 'text-emerald-400'
                                    : sub.selisihRp < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {sub.selisihRp > 0 ? '+' : ''}
                                {formatRupiah(sub.selisihRp)}
                              </td>
                              <td
                                className={`py-3 px-3 text-right text-xs font-semibold ${
                                  sub.selisihPct > 0
                                    ? 'text-emerald-400'
                                    : sub.selisihPct < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {formatPercent(sub.selisihPct)}
                              </td>
                              <td className="py-3 px-3 text-right text-xs font-medium text-slate-200">
                                {formatNumber(sub.trxD1)}
                              </td>
                              <td className="py-3 px-3 text-right text-xs text-slate-500">
                                {formatNumber(sub.trxD2)}
                              </td>
                              <td className="py-3 px-3 text-right text-xs text-indigo-300/90">
                                {formatRupiah(sub.labaD1)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {renderTrendBadge(sub.trend, sub.selisihPct)}
                              </td>
                            </tr>

                            {/* Level 3: Individual Product Codes inside Sub-Category */}
                            {isSubExpanded &&
                              sub.products?.map((prod) => (
                                <tr
                                  key={`${subKey}::${prod.produk}`}
                                  className="bg-slate-950 border-l-4 border-slate-700 text-xs text-slate-300 animate-fade-in"
                                >
                                  <td className="py-2.5 pl-20 pr-4">
                                    <div className="flex items-center gap-2">
                                      <Package className="w-3.5 h-3.5 text-slate-500" />
                                      <span className="font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                                        {prod.produk}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono text-slate-200">
                                    {formatRupiah(prod.omsetD1)}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                                    {formatRupiah(prod.omsetD2)}
                                  </td>
                                  <td
                                    className={`py-2.5 px-4 text-right font-mono ${
                                      prod.selisihRp > 0
                                        ? 'text-emerald-400'
                                        : prod.selisihRp < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {prod.selisihRp > 0 ? '+' : ''}
                                    {formatRupiah(prod.selisihRp)}
                                  </td>
                                  <td
                                    className={`py-2.5 px-3 text-right font-mono ${
                                      prod.selisihPct > 0
                                        ? 'text-emerald-400'
                                        : prod.selisihPct < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {formatPercent(prod.selisihPct)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                    {formatNumber(prod.trxD1)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                    {formatNumber(prod.trxD2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                                    {formatRupiah(prod.labaD1)}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {renderTrendBadge(prod.trend, prod.selisihPct)}
                                  </td>
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Grand Total Footer */}
            <tfoot>
              <tr className="bg-slate-950 border-t-2 border-slate-700 font-bold text-sm text-white tabular-nums">
                <td className="py-4 px-5">TOTAL KESELURUHAN SERVER</td>
                <td className="py-4 px-4 text-right text-emerald-400">
                  {formatRupiah(kpi?.omset?.d1 || 0)}
                </td>
                <td className="py-4 px-4 text-right text-slate-300">
                  {formatRupiah(kpi?.omset?.d2 || 0)}
                </td>
                <td
                  className={`py-4 px-4 text-right ${
                    (kpi?.omset?.diff || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(kpi?.omset?.diff || 0) > 0 ? '+' : ''}
                  {formatRupiah(kpi?.omset?.diff || 0)}
                </td>
                <td
                  className={`py-4 px-3 text-right ${
                    (kpi?.omset?.pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatPercent(kpi?.omset?.pct || 0)}
                </td>
                <td className="py-4 px-3 text-right">
                  {formatNumber(kpi?.transaksiSukses?.d1 || 0)}
                </td>
                <td className="py-4 px-3 text-right text-slate-400">
                  {formatNumber(kpi?.transaksiSukses?.d2 || 0)}
                </td>
                <td className="py-4 px-3 text-right text-indigo-300">
                  {formatRupiah(kpi?.labaBersih?.d1 || 0)}
                </td>
                <td className="py-4 px-4 text-center">
                  {renderTrendBadge(kpi?.omset?.trend || 'flat', kpi?.omset?.pct || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

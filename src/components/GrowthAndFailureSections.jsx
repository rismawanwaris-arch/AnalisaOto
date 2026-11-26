import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  AlertOctagon,
  PackageX,
  UserX,
  WifiOff,
  Server,
  Award,
  Search,
  Filter,
} from 'lucide-react';
import {
  formatRupiah,
  formatCompactRupiah,
  formatNumber,
  formatPercent,
} from '../utils/format.js';
import { sortArray, toggleSortConfig } from '../utils/sort.js';
import SortableTh from './SortableTh.jsx';

export default function GrowthAndFailureSections({
  growth = {},
  failureAudit = {},
  period = {},
  sectionMode = 'all', // 'all' | 'growth_only' | 'failure_only'
}) {
  const [growthTab, setGrowthTab] = useState('products'); // 'products' | 'resellers' | 'modules'
  const [showCount, setShowCount] = useState(5);
  const [failureBucketFilter, setFailureBucketFilter] = useState('ALL');
  const [failureSearch, setFailureSearch] = useState('');
  const [moduleSort, setModuleSort] = useState({ key: 'omsetD1', dir: 'desc' });
  const [failureSort, setFailureSort] = useState({ key: 'tglEntri', dir: 'desc' });

  const topProductGainers = (growth?.topProductGainers || []).slice(0, showCount);
  const topProductLosers = (growth?.topProductLosers || []).slice(0, showCount);
  const topResellerGainers = (growth?.topResellerGainers || []).slice(0, showCount);
  const topResellerLosers = (growth?.topResellerLosers || []).slice(0, showCount);
  const topResellersByOmset = (growth?.topResellersByOmsetD1 || []).slice(0, 8);
  const modulePerformance = useMemo(
    () => sortArray(growth?.modulePerformance || [], moduleSort),
    [growth?.modulePerformance, moduleSort]
  );

  const filteredFailureRecords = useMemo(() => {
    const records = failureAudit?.recordsD1 || [];
    const q = failureSearch.trim().toLowerCase();
    const filtered = records.filter((r) => {
      if (failureBucketFilter !== 'ALL' && r.bucket !== failureBucketFilter) return false;
      if (q) {
        const hay = `${r.produk} ${r.tujuan} ${r.reseller} ${r.modul} ${r.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortArray(filtered, failureSort);
  }, [failureAudit, failureBucketFilter, failureSearch, failureSort]);

  const getBucketIcon = (id) => {
    if (id === 'stok_kosong') return <PackageX className="w-5 h-5 text-amber-400" />;
    if (id === 'tujuan_salah') return <UserX className="w-5 h-5 text-cyan-400" />;
    return <WifiOff className="w-5 h-5 text-rose-400" />;
  };

  const getBucketStyle = (id, isSelected) => {
    if (id === 'stok_kosong') {
      return isSelected
        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
        : 'bg-slate-950/70 border-amber-500/30 hover:border-amber-500/60';
    }
    if (id === 'tujuan_salah') {
      return isSelected
        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
        : 'bg-slate-950/70 border-cyan-500/30 hover:border-cyan-500/60';
    }
    return isSelected
      ? 'bg-rose-500/20 border-rose-500 text-rose-200'
      : 'bg-slate-950/70 border-rose-500/30 hover:border-rose-500/60';
  };

  return (
    <div className="space-y-6">
      {/* SECTION D: Analisis Pertumbuhan (Top Gainers & Losers) */}
      {sectionMode !== 'failure_only' && (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Analisis Pertumbuhan: Top Gainers & Losers (Produk, Reseller & Supplier)
              </h3>
              <p className="text-xs text-slate-400">
                Deteksi lonjakan dan penurunan tertinggi pada {period?.d1Label} dibanding {period?.d2Label}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {growthTab !== 'modules' && (
              <select
                value={showCount}
                onChange={(e) => setShowCount(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300 focus:outline-none"
              >
                <option value={5}>Tampilkan Top 5</option>
                <option value={10}>Tampilkan Top 10</option>
              </select>
            )}

            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setGrowthTab('products')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  growthTab === 'products'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pergerakan Produk
              </button>
              <button
                type="button"
                onClick={() => setGrowthTab('resellers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  growthTab === 'resellers'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pergerakan Reseller
              </button>
              <button
                type="button"
                onClick={() => setGrowthTab('modules')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  growthTab === 'modules'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Jalur Modul Supplier
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Top 5 Produk Paling Meningkat & Paling Menurun */}
        {growthTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5 animate-fade-in">
            {/* Top Gainers Products */}
            <div className="rounded-xl bg-slate-950/70 border border-emerald-500/25 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Top {showCount} Produk Paling Meningkat (Top Gainers)
                  </h4>
                </div>
                <span className="text-[11px] text-emerald-400/80">Kenaikan Omset Tertinggi</span>
              </div>

              <div className="divide-y divide-slate-800/70">
                {topProductGainers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Belum ada kenaikan produk antara D1 dan D2.
                  </div>
                ) : (
                  topProductGainers.map((p, idx) => (
                    <div
                      key={p.produk}
                      className="p-3.5 hover:bg-slate-900/60 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white">
                              {p.produk}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 truncate">
                              {p.subCategory}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                            D1: <strong className="text-slate-200">{formatRupiah(p.omsetD1)}</strong> ({p.trxD1} Trx) vs D2: {formatCompactRupiah(p.omsetD2)} ({p.trxD2} Trx)
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-bold text-emerald-400">
                          +{formatRupiah(p.selisihRp)}
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-500">
                          +{p.selisihPct}% ({p.trxDiff >= 0 ? `+${p.trxDiff}` : p.trxDiff} Trx)
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Losers Products */}
            <div className="rounded-xl bg-slate-950/70 border border-rose-500/25 overflow-hidden">
              <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Top {showCount} Produk Paling Menurun (Top Losers)
                  </h4>
                </div>
                <span className="text-[11px] text-rose-400/80">Indikasi Penurunan Minat / Harga</span>
              </div>

              <div className="divide-y divide-slate-800/70">
                {topProductLosers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Tidak ada produk yang mengalami penurunan omset.
                  </div>
                ) : (
                  topProductLosers.map((p, idx) => (
                    <div
                      key={p.produk}
                      className="p-3.5 hover:bg-slate-900/60 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white">
                              {p.produk}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 truncate">
                              {p.subCategory}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                            D1: <strong className="text-slate-200">{formatRupiah(p.omsetD1)}</strong> ({p.trxD1} Trx) vs D2: {formatCompactRupiah(p.omsetD2)} ({p.trxD2} Trx)
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-bold text-rose-400">
                          {formatRupiah(p.selisihRp)}
                        </div>
                        <div className="text-[11px] font-semibold text-rose-500">
                          {p.selisihPct}% ({p.trxDiff} Trx)
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Pergerakan Reseller */}
        {growthTab === 'resellers' && (
          <div className="space-y-6 mt-5 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reseller Gainers */}
              <div className="rounded-xl bg-slate-950/70 border border-emerald-500/25 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Reseller Peningkatan Omset Tertinggi
                    </h4>
                  </div>
                  <span className="text-[11px] text-emerald-400/80">Top Agen Bertumbuh</span>
                </div>
                <div className="divide-y divide-slate-800/70">
                  {topResellerGainers.map((r, idx) => (
                    <div
                      key={r.reseller}
                      className="p-3.5 hover:bg-slate-900/60 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white truncate">{r.reseller}</div>
                          <div className="text-xs text-slate-400 tabular-nums">
                            D1: <strong className="text-slate-200">{formatRupiah(r.omsetD1)}</strong> ({r.trxD1} Trx) | Komisi: {formatRupiah(r.komisiD1)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-bold text-emerald-400">
                          +{formatRupiah(r.selisihRp)}
                        </div>
                        <div className="text-[11px] text-emerald-500">
                          +{r.selisihPct}% ({r.trxDiff >= 0 ? `+${r.trxDiff}` : r.trxDiff} Trx)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reseller Losers */}
              <div className="rounded-xl bg-slate-950/70 border border-rose-500/25 overflow-hidden">
                <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                      Reseller Penurunan Omset Terbesar
                    </h4>
                  </div>
                  <span className="text-[11px] text-rose-400/80">Waspada Churn / Pindah Jalur</span>
                </div>
                <div className="divide-y divide-slate-800/70">
                  {topResellerLosers.map((r, idx) => (
                    <div
                      key={r.reseller}
                      className="p-3.5 hover:bg-slate-900/60 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-white truncate">{r.reseller}</div>
                          <div className="text-xs text-slate-400 tabular-nums">
                            D1: <strong className="text-slate-200">{formatRupiah(r.omsetD1)}</strong> ({r.trxD1} Trx) vs D2: {formatCompactRupiah(r.omsetD2)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-bold text-rose-400">
                          {formatRupiah(r.selisihRp)}
                        </div>
                        <div className="text-[11px] text-rose-500">
                          {r.selisihPct}% ({r.trxDiff} Trx)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Resellers Overall Leaderboard */}
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Leaderboard Reseller Kontributor Omset Terbesar ({period?.d1Label})
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {topResellersByOmset.map((r, i) => (
                  <div
                    key={r.reseller}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800/90 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        #{i + 1} {r.reseller}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                        {r.trxD1} Trx
                      </span>
                    </div>
                    <div className="mt-2 tabular-nums">
                      <div className="text-sm font-extrabold text-emerald-400">
                        {formatRupiah(r.omsetD1)}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Komisi: {formatRupiah(r.komisiD1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Performa Jalur Modul Supplier */}
        {growthTab === 'modules' && (
          <div className="mt-5 overflow-x-auto animate-fade-in">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase">
                  <SortableTh
                    label="Modul / Jalur Supplier"
                    sortKey="modul"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    defaultDir="asc"
                    className="py-3 px-4"
                  />
                  <SortableTh
                    label="Omset D1"
                    sortKey="omsetD1"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    align="right"
                    className="py-3 px-4"
                  />
                  <SortableTh
                    label="Omset D2"
                    sortKey="omsetD2"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    align="right"
                    className="py-3 px-4"
                  />
                  <SortableTh
                    label="Trx Sukses D1"
                    sortKey="suksesTrxD1"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    align="right"
                    className="py-3 px-4"
                  />
                  <SortableTh
                    label="Trx Gagal D1"
                    sortKey="gagalTrxD1"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    align="right"
                    className="py-3 px-4"
                  />
                  <SortableTh
                    label="Success Rate"
                    sortKey="successRateD1"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    align="right"
                    className="py-3 px-4"
                  />
                  <SortableTh
                    label="Laba Server D1"
                    sortKey="labaD1"
                    sortConfig={moduleSort}
                    onSort={(k, d) => setModuleSort((prev) => toggleSortConfig(prev, k, d))}
                    align="right"
                    className="py-3 px-4"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {modulePerformance.map((m) => (
                  <tr key={m.modul} className="hover:bg-slate-950/60">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300 flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-slate-500" />
                      {m.modul}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {formatRupiah(m.omsetD1)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {formatRupiah(m.omsetD2)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                      {formatNumber(m.suksesTrxD1)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-rose-400">
                      {formatNumber(m.gagalTrxD1)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          m.successRateD1 >= 98
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : m.successRateD1 >= 90
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {m.successRateD1}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-indigo-300">
                      {formatRupiah(m.labaD1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* SECTION E: Audit Kegagalan & Gangguan Operasional */}
      {sectionMode !== 'growth_only' && (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Audit Kegagalan & Gangguan Operasional ({period?.d1Label} vs {period?.d2Label})
              </h3>
              <p className="text-xs text-slate-400">
                Pemantauan transaksi tidak sukses: Stok Kosong, Tujuan Salah, serta Produk Gangguan / Timeout
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
              Total Tidak Sukses D1: {formatNumber(failureAudit?.summary?.totalD1 || 0)} Trx
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
              D2: {formatNumber(failureAudit?.summary?.totalD2 || 0)} Trx
            </span>
          </div>
        </div>

        {/* 3 Failure Bucket Cards (Stok Kosong, Tujuan Salah, Produk Gangguan / Timeout) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {(failureAudit?.summary?.buckets || []).map((b) => {
            const isSelected = failureBucketFilter === b.id;
            return (
              <div
                key={b.id}
                onClick={() => setFailureBucketFilter(isSelected ? 'ALL' : b.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${getBucketStyle(
                  b.id,
                  isSelected
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      {getBucketIcon(b.id)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{b.name}</h4>
                      <p className="text-[11px] text-slate-400">{b.subtitle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {isSelected ? 'Filter Aktif' : 'Klik Filter'}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline justify-between tabular-nums">
                  <div>
                    <span className="text-2xl font-extrabold text-white">{b.d1}</span>
                    <span className="text-xs text-slate-400 ml-1.5">Trx pada D1</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    vs D2: <strong className="text-slate-200">{b.d2} Trx</strong> (
                    <span className={b.diff > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                      {b.diff > 0 ? `+${b.diff}` : b.diff}
                    </span>
                    )
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter & Search Bar for Failed Transactions Table */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            {[
              { id: 'ALL', label: `Semua Kegagalan (${failureAudit?.recordsD1?.length || 0})` },
              { id: 'stok_kosong', label: 'Stok Kosong' },
              { id: 'tujuan_salah', label: 'Tujuan Salah' },
              { id: 'gangguan_timeout', label: 'Gangguan / Timeout / Gagal' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFailureBucketFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  failureBucketFilter === f.id
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={failureSearch}
              onChange={(e) => setFailureSearch(e.target.value)}
              placeholder="Cari produk, tujuan, reseller..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Failed Transactions Table */}
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase">
              <tr>
                <SortableTh
                  label="Waktu Entri"
                  sortKey="tglEntri"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  className="py-2.5 px-4"
                />
                <SortableTh
                  label="Kode Produk"
                  sortKey="produk"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  defaultDir="asc"
                  className="py-2.5 px-3"
                />
                <SortableTh
                  label="Nomor Tujuan"
                  sortKey="tujuan"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  defaultDir="asc"
                  className="py-2.5 px-3"
                />
                <SortableTh
                  label="Nama Reseller"
                  sortKey="reseller"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  defaultDir="asc"
                  className="py-2.5 px-3"
                />
                <SortableTh
                  label="Modul Supplier"
                  sortKey="modul"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  defaultDir="asc"
                  className="py-2.5 px-3"
                />
                <SortableTh
                  label="Nilai Jual"
                  sortKey="hrgJual"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  align="right"
                  className="py-2.5 px-3"
                />
                <SortableTh
                  label="Status Kegagalan"
                  sortKey="status"
                  sortConfig={failureSort}
                  onSort={(k, d) => setFailureSort((prev) => toggleSortConfig(prev, k, d))}
                  align="center"
                  defaultDir="asc"
                  className="py-2.5 px-4"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredFailureRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Tidak ada transaksi gagal untuk filter ini.
                  </td>
                </tr>
              ) : (
                filteredFailureRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-950/60">
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {String(rec.tglEntri).replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {rec.produk}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {rec.tujuan}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{rec.reseller}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-300">{rec.modul}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {formatRupiah(rec.hrgJual)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          rec.bucket === 'stok_kosong'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : rec.bucket === 'tujuan_salah'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

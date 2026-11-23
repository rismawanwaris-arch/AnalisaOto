import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Store,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronDown,
  Search,
  Award,
  Clock,
  BarChart3,
  Layers,
  Eye,
  X,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  LayoutGrid,
} from 'lucide-react';
import {
  formatRupiah,
  formatCompactRupiah,
  formatNumber,
  formatPercent,
  useAnimatedNumber,
} from '../utils/format.js';

export default function OutletAnalyticsView({
  outletAnalytics = {},
  period = {},
  compactMode = false,
  onNavigateToFullOutletView,
  initialSubTab = 'overview_plc_kbb',
}) {
  const kpi = outletAnalytics?.kpi || {};
  const groupComparison = outletAnalytics?.outletGroupComparison || [];
  const allOutlets = outletAnalytics?.allOutlets || [];

  // 4 Sub-Menu Utama di halaman Outlet agar sangat mudah dianalisa:
  // 'overview_plc_kbb' | 'plc_only' | 'kbb_only' | 'gainers_losers' | 'all_ranking'
  const [subMenuTab, setSubMenuTab] = useState(initialSubTab || 'overview_plc_kbb');
  const [selectedSubCluster, setSelectedSubCluster] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOutlets, setExpandedOutlets] = useState({});
  const [inspectedOutlet, setInspectedOutlet] = useState(null);

  useEffect(() => {
    if (initialSubTab) {
      setSubMenuTab(initialSubTab);
    }
  }, [initialSubTab]);

  const animOfficialOmset = useAnimatedNumber(kpi?.officialOmset?.d1 || 0);
  const animPlcOmset = useAnimatedNumber(kpi?.plcSummary?.omsetD1 || 0);
  const animKbbOmset = useAnimatedNumber(kpi?.kbbSummary?.omsetD1 || 0);

  const plcOutlets = useMemo(
    () => allOutlets.filter((o) => o.groupId === 'out_plc'),
    [allOutlets]
  );
  const kbbOutlets = useMemo(
    () => allOutlets.filter((o) => o.groupId === 'out_kbb'),
    [allOutlets]
  );

  // Ringkasan 6 Sub-Klaster (5 Sub-Klaster PLC + 1 KBB)
  const subClusterSummaries = useMemo(() => {
    const clusters = [
      { id: 'PLC Cabang Reguler', title: 'PLC — Cabang Reguler & Utama', badge: 'Kategori PLC', color: '#6366f1' },
      { id: 'PLC Klaster ALFA', title: 'PLC — Klaster ALFA (Alfamart)', badge: 'Kategori PLC', color: '#8b5cf6' },
      { id: 'PLC Klaster PD/ASBER/BAKSAR', title: 'PLC — Klaster PD / ASBER / BAKSAR / CIKADUT', badge: 'Kategori PLC', color: '#06b6d4' },
      { id: 'PLC Klaster BK', title: 'PLC — Klaster BK (Bandar Kuota)', badge: 'Kategori PLC', color: '#3b82f6' },
      { id: 'PLC Klaster CL & PC', title: 'PLC — Klaster CL & PC', badge: 'Kategori PLC', color: '#f59e0b' },
      { id: 'Cabang Wilayah KBB', title: 'KBB — Wilayah Bandung Barat', badge: 'Kategori KBB', color: '#10b981' },
    ];

    return clusters.map((c) => {
      const items = allOutlets.filter((o) => o.subCluster === c.id);
      const omsetD1 = items.reduce((s, o) => s + o.omsetD1, 0);
      const omsetD2 = items.reduce((s, o) => s + o.omsetD2, 0);
      const trxD1 = items.reduce((s, o) => s + o.trxD1, 0);
      const trxD2 = items.reduce((s, o) => s + o.trxD2, 0);
      const diff = omsetD1 - omsetD2;
      const pct = omsetD2 > 0 ? Number(((diff / omsetD2) * 100).toFixed(2)) : omsetD1 > 0 ? 100 : 0;
      const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
      return {
        ...c,
        count: items.length,
        omsetD1,
        omsetD2,
        trxD1,
        trxD2,
        diff,
        pct,
        trend,
        topOutlet: items[0] || null,
        outlets: items,
      };
    });
  }, [allOutlets]);

  const filteredPlcOutlets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return plcOutlets.filter((o) => {
      if (selectedSubCluster !== 'ALL' && o.subCluster !== selectedSubCluster) return false;
      if (q) {
        return `${o.outletName} ${o.outletCode} ${o.subCluster}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [plcOutlets, selectedSubCluster, searchQuery]);

  const filteredKbbOutlets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return kbbOutlets.filter((o) => {
      if (q) {
        return `${o.outletName} ${o.outletCode}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [kbbOutlets, searchQuery]);

  const filteredAllOutlets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allOutlets.filter((o) => {
      if (selectedSubCluster !== 'ALL' && o.subCluster !== selectedSubCluster) return false;
      if (q) {
        return `${o.outletName} ${o.outletCode} ${o.groupShortName} ${o.subCluster}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allOutlets, selectedSubCluster, searchQuery]);

  const outletGainers = useMemo(
    () => [...allOutlets].filter((o) => o.selisihRp > 0).sort((a, b) => b.selisihRp - a.selisihRp),
    [allOutlets]
  );

  const outletLosers = useMemo(
    () => [...allOutlets].filter((o) => o.selisihRp < 0).sort((a, b) => a.selisihRp - b.selisihRp),
    [allOutlets]
  );

  const toggleOutletDrilldown = (outletName, e) => {
    if (e) e.stopPropagation();
    setExpandedOutlets((prev) => ({ ...prev, [outletName]: !prev[outletName] }));
  };

  const renderTrendBadge = (trend, pct) => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <TrendingUp className="w-3 h-3" />
          {formatPercent(pct)}
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <TrendingDown className="w-3 h-3" />
          {formatPercent(pct)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400">
        <Minus className="w-3 h-3" />
        0%
      </span>
    );
  };

  const renderOutletTable = (outletsList, title, subtitle, accentColor = '#6366f1') => (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden animate-fade-in">
      <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama cabang / kode ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs tabular-nums">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-3.5 px-4 w-12">No</th>
              <th className="py-3.5 px-4 min-w-[250px]">Nama Cabang & Klaster</th>
              <th className="py-3.5 px-3 text-center">Kode ID</th>
              <th className="py-3.5 px-4 text-right">Omset D1 ({period?.d1Label})</th>
              <th className="py-3.5 px-4 text-right">Omset D2 ({period?.d2Label})</th>
              <th className="py-3.5 px-4 text-right">Selisih (Rp)</th>
              <th className="py-3.5 px-3 text-right">Trx D1</th>
              <th className="py-3.5 px-3 text-right">Komisi D1</th>
              <th className="py-3.5 px-3 text-center">Tren DoD</th>
              <th className="py-3.5 px-4 text-right">Aksi Analisa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {outletsList.map((outlet, idx) => {
              const isExpanded = !!expandedOutlets[outlet.outletName];
              return (
                <React.Fragment key={outlet.outletName}>
                  <tr
                    onClick={(e) => toggleOutletDrilldown(outlet.outletName, e)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors border-l-4"
                    style={{ borderLeftColor: outlet.groupColor || accentColor }}
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-400">#{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </span>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                            <span>{outlet.outletName}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                outlet.groupId === 'out_kbb'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                              }`}
                            >
                              {outlet.subCluster || outlet.groupShortName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Jam Sibuk: <span className="text-slate-200 font-mono">{outlet.peakHour}</span> • Klik baris untuk lihat 5 kategori produk
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                        {outlet.outletCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-sm text-white">
                      {formatRupiah(outlet.omsetD1)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      {formatRupiah(outlet.omsetD2)}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-bold ${
                        outlet.selisihRp > 0
                          ? 'text-emerald-400'
                          : outlet.selisihRp < 0
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {outlet.selisihRp > 0 ? '+' : ''}
                      {formatRupiah(outlet.selisihRp)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-200">
                      {formatNumber(outlet.trxD1)}
                    </td>
                    <td className="py-3.5 px-3 text-right text-amber-300">
                      {formatRupiah(outlet.komisiD1)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {renderTrendBadge(outlet.trend, outlet.selisihPct)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedOutlet(outlet);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 border border-indigo-500/30 font-bold text-[11px] transition-colors"
                      >
                        Detail 360°
                      </button>
                    </td>
                  </tr>

                  {/* Rincian 5 Pilar Kategori Produk di dalam Cabang tersebut */}
                  {isExpanded && (
                    <tr className="bg-slate-950 border-l-4 border-cyan-500 animate-fade-in">
                      <td colSpan={10} className="py-4 px-6">
                        <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                              <Layers className="w-4 h-4" />
                              <span>
                                Komposisi Kategori Produk di Cabang:{' '}
                                <strong className="text-white">{outlet.outletName}</strong> ({outlet.outletCode})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectedOutlet(outlet)}
                              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Buka Grafik 24 Jam & Top 12 Produk Cabang Ini →
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                            {(outlet.categoryBreakdown || []).map((cb) => (
                              <div
                                key={cb.categoryId}
                                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="text-xs font-bold text-slate-200 truncate">
                                    {cb.shortName}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300">
                                    {cb.sharePct}%
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <div className="text-sm font-extrabold text-white">
                                    {formatRupiah(cb.omsetD1)}
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                    <span>{cb.trxD1} Trx (D2: {cb.trxD2})</span>
                                    <span
                                      className={
                                        cb.selisihRp >= 0
                                          ? 'text-emerald-400 font-bold'
                                          : 'text-rose-400 font-bold'
                                      }
                                    >
                                      {formatPercent(cb.selisihPct)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 4 Kartu Ringkasan Utama PLC & KBB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Gabungan PLC & KBB */}
        <div
          onClick={() => setSubMenuTab('overview_plc_kbb')}
          className="rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-5 shadow-xl cursor-pointer transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Gabungan PLC & KBB ({kpi?.officialTrx?.totalOutlets || 45} Cabang)
              </p>
              <h3 className="text-2xl font-extrabold text-white mt-1.5 tabular-nums">
                {formatRupiah(animOfficialOmset)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {formatNumber(kpi?.officialTrx?.d1 || 0)} Trx Sukses
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">
              {kpi?.officialOmset?.sharePct || 0}% dari Server
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs tabular-nums">
            {renderTrendBadge(kpi?.officialOmset?.trend, kpi?.officialOmset?.pct)}
            <span className="text-slate-400">
              D2: {formatCompactRupiah(kpi?.officialOmset?.d2 || 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Kategori Cabang PLC */}
        <div
          onClick={() => {
            setSubMenuTab('plc_only');
            setSelectedSubCluster('ALL');
          }}
          className={`rounded-2xl bg-slate-900/90 border p-5 shadow-xl cursor-pointer transition-all ${
            subMenuTab === 'plc_only'
              ? 'border-indigo-400 ring-1 ring-indigo-500/40'
              : 'border-indigo-500/30 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                1. Kategori Cabang PLC ({kpi?.plcSummary?.outletCount || 41} Cabang)
              </p>
              <h3 className="text-2xl font-extrabold text-white mt-1.5 tabular-nums">
                {formatRupiah(animPlcOmset)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
            <span className="px-2 py-0.5 rounded font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {formatNumber(kpi?.plcSummary?.trxD1 || 0)} Trx ({kpi?.plcSummary?.shareD1Pct || 0}%)
            </span>
            <span className="text-slate-400">
              Rata2: {formatCompactRupiah(kpi?.plcSummary?.avgOmsetPerOutletD1 || 0)}/cabang
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs tabular-nums">
            {renderTrendBadge(kpi?.plcSummary?.trend, kpi?.plcSummary?.selisihPct)}
            <span className="text-indigo-400 font-bold">Klik Buka 41 PLC →</span>
          </div>
        </div>

        {/* Card 3: Kategori Cabang KBB */}
        <div
          onClick={() => setSubMenuTab('kbb_only')}
          className={`rounded-2xl bg-slate-900/90 border p-5 shadow-xl cursor-pointer transition-all ${
            subMenuTab === 'kbb_only'
              ? 'border-emerald-400 ring-1 ring-emerald-500/40'
              : 'border-emerald-500/30 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                2. Kategori Cabang KBB ({kpi?.kbbSummary?.outletCount || 4} Cabang)
              </p>
              <h3 className="text-2xl font-extrabold text-white mt-1.5 tabular-nums">
                {formatRupiah(animKbbOmset)}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
            <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {formatNumber(kpi?.kbbSummary?.trxD1 || 0)} Trx ({kpi?.kbbSummary?.shareD1Pct || 0}%)
            </span>
            <span className="text-slate-400">
              Rata2: {formatCompactRupiah(kpi?.kbbSummary?.avgOmsetPerOutletD1 || 0)}/cabang
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs tabular-nums">
            {renderTrendBadge(kpi?.kbbSummary?.trend, kpi?.kbbSummary?.selisihPct)}
            <span className="text-emerald-400 font-bold">Klik Buka 4 KBB →</span>
          </div>
        </div>

        {/* Card 4: Cabang #1 Terbaik PLC & KBB */}
        <div className="rounded-2xl bg-slate-900/90 border border-amber-500/30 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Cabang #1 Terbaik (PLC & KBB)
            </span>
          </div>

          <div className="space-y-2 text-xs tabular-nums">
            {kpi?.topPlcOutletD1 && (
              <div
                onClick={() => setInspectedOutlet(kpi.topPlcOutletD1)}
                className="p-2 rounded-xl bg-slate-950/90 border border-indigo-500/30 hover:border-indigo-400 cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-indigo-400">TOP #1 PLC</div>
                  <div className="font-bold text-white truncate">{kpi.topPlcOutletD1.outletName}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-emerald-400">{formatCompactRupiah(kpi.topPlcOutletD1.omsetD1)}</div>
                  <div className="text-[10px] text-slate-400">{kpi.topPlcOutletD1.trxD1} Trx</div>
                </div>
              </div>
            )}

            {kpi?.topKbbOutletD1 && (
              <div
                onClick={() => setInspectedOutlet(kpi.topKbbOutletD1)}
                className="p-2 rounded-xl bg-slate-950/90 border border-emerald-500/30 hover:border-emerald-400 cursor-pointer flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-emerald-400">TOP #1 KBB</div>
                  <div className="font-bold text-white truncate">{kpi.topKbbOutletD1.outletName}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-emerald-400">{formatCompactRupiah(kpi.topKbbOutletD1.omsetD1)}</div>
                  <div className="text-[10px] text-slate-400">{kpi.topKbbOutletD1.trxD1} Trx</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigasi Sub-Menu Analisa Cabang (4 Tab Jelas agar Tidak Bingung) */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2 shadow-lg flex flex-wrap items-center gap-2">
        {[
          {
            id: 'overview_plc_kbb',
            label: '1. Ringkasan Kategori PLC vs KBB',
            badge: '6 Klaster',
            color: 'indigo',
          },
          {
            id: 'plc_only',
            label: '2. Fokus Kategori Cabang PLC',
            badge: `${plcOutlets.length} Cabang`,
            color: 'indigo',
          },
          {
            id: 'kbb_only',
            label: '3. Fokus Kategori Cabang KBB',
            badge: `${kbbOutlets.length} Cabang`,
            color: 'emerald',
          },
          {
            id: 'gainers_losers',
            label: '4. Evaluasi Cabang Naik vs Turun',
            badge: `${outletGainers.length} Naik / ${outletLosers.length} Turun`,
            color: 'amber',
          },
          {
            id: 'all_ranking',
            label: '5. Tabel Ranking Gabungan',
            badge: `${allOutlets.length} Cabang`,
            color: 'slate',
          },
        ].map((tab) => {
          const active = subMenuTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubMenuTab(tab.id);
                if (tab.id !== 'plc_only') setSelectedSubCluster('ALL');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-950/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ISI SUB-MENU 1: RINGKASAN KATEGORI PLC VS KBB + 6 KARTU SUB-KLASTER */}
      {subMenuTab === 'overview_plc_kbb' && (
        <div className="space-y-6 animate-fade-in">
          {/* Perbandingan Berdampingan PLC vs KBB */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {groupComparison.map((grp) => {
              const isKbb = grp.groupId === 'out_kbb';
              return (
                <div
                  key={grp.groupId}
                  className={`rounded-2xl bg-slate-900/90 border p-6 shadow-xl flex flex-col justify-between ${
                    isKbb ? 'border-emerald-500/30' : 'border-indigo-500/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: grp.color }}
                        />
                        <h3 className="text-base font-extrabold text-white">{grp.name}</h3>
                      </div>
                      {renderTrendBadge(grp.trend, grp.selisihPct)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{grp.description}</p>

                    <div className="grid grid-cols-3 gap-3 mt-4 tabular-nums">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          Omset D1 ({period?.d1Label})
                        </div>
                        <div className="text-sm sm:text-base font-extrabold text-white mt-1">
                          {formatRupiah(grp.omsetD1)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          D2: {formatCompactRupiah(grp.omsetD2)}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          Total Transaksi
                        </div>
                        <div className="text-sm sm:text-base font-extrabold text-white mt-1">
                          {formatNumber(grp.trxD1)} Trx
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {grp.activeOutletsD1} Cabang Aktif
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          Rata-Rata / Cabang
                        </div>
                        <div className="text-sm sm:text-base font-extrabold text-cyan-300 mt-1">
                          {formatCompactRupiah(grp.avgOmsetPerOutletD1)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Porsi: {grp.shareD1Pct}% Server
                        </div>
                      </div>
                    </div>

                    {/* Top 3 Cabang di Kategori Ini */}
                    <div className="mt-4">
                      <div className="text-xs font-bold text-slate-300 mb-2">
                        Top 3 Cabang Teratas di {grp.shortName}:
                      </div>
                      <div className="space-y-1.5">
                        {(grp.outlets || []).slice(0, 3).map((o, i) => (
                          <div
                            key={o.outletName}
                            onClick={() => setInspectedOutlet(o)}
                            className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-indigo-500/40 cursor-pointer flex items-center justify-between text-xs tabular-nums"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="font-bold text-white">{o.outletName}</span>
                              <span className="font-mono text-[10px] text-indigo-300">
                                ({o.outletCode})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-emerald-400">
                                {formatRupiah(o.omsetD1)}
                              </span>
                              <span className="text-slate-400">{o.trxD1} Trx</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSubMenuTab(isKbb ? 'kbb_only' : 'plc_only')}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold text-white shadow transition-all ${
                        isKbb
                          ? 'bg-emerald-600 hover:bg-emerald-500'
                          : 'bg-indigo-600 hover:bg-indigo-500'
                      }`}
                    >
                      Lihat Semua {grp.outletCount} Cabang di {grp.shortName} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 6 Kartu Klaster Cabang (5 Sub-Klaster PLC + 1 Klaster KBB) */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-indigo-400" />
                  Peta Performa 6 Klaster Cabang (5 Sub-Klaster PLC & 1 Wilayah KBB)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik salah satu kartu klaster di bawah untuk langsung melihat daftar cabang di klaster tersebut.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {subClusterSummaries.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => {
                    if (sc.id === 'Cabang Wilayah KBB') {
                      setSubMenuTab('kbb_only');
                    } else {
                      setSelectedSubCluster(sc.id);
                      setSubMenuTab('plc_only');
                    }
                  }}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition-all flex flex-col justify-between tabular-nums"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sc.badge === 'Kategori KBB'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {sc.badge} • {sc.count} Cabang
                      </span>
                      {renderTrendBadge(sc.trend, sc.pct)}
                    </div>
                    <h4 className="text-sm font-extrabold text-white mt-2">{sc.title}</h4>
                    <div className="text-xl font-extrabold text-white mt-2">
                      {formatRupiah(sc.omsetD1)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                      <span>{formatNumber(sc.trxD1)} Trx Sukses</span>
                      <span>D2: {formatCompactRupiah(sc.omsetD2)}</span>
                    </div>
                  </div>

                  {sc.topOutlet && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        Tertinggi: <strong className="text-slate-200">{sc.topOutlet.outletName}</strong>
                      </span>
                      <span className="text-indigo-400 font-bold">Lihat {sc.count} Cabang →</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ISI SUB-MENU 2: KHUSUS KATEGORI CABANG PLC (41 CABANG) DENGAN FILTER SUB-KLASTER */}
      {subMenuTab === 'plc_only' && (
        <div className="space-y-4 animate-fade-in">
          {/* Tombol Filter Sub-Klaster PLC */}
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-300 mr-1">
                Filter Sub-Klaster PLC:
              </span>
              {[
                { id: 'ALL', label: `Semua PLC (${plcOutlets.length})` },
                { id: 'PLC Cabang Reguler', label: 'Cabang Reguler (13)' },
                { id: 'PLC Klaster ALFA', label: 'Klaster ALFA (7)' },
                { id: 'PLC Klaster PD/ASBER/BAKSAR', label: 'Klaster PD/ASBER/BAKSAR (9)' },
                { id: 'PLC Klaster BK', label: 'Klaster BK (5)' },
                { id: 'PLC Klaster CL & PC', label: 'Klaster CL & PC (7)' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedSubCluster(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedSubCluster === btn.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {renderOutletTable(
            filteredPlcOutlets,
            `Daftar Kategori Outlet Cabang PLC (${filteredPlcOutlets.length} Cabang)`,
            'Klik pada baris cabang PLC untuk membuka komposisi 5 kategori produk di cabang tersebut, atau klik Detail 360°.',
            '#6366f1'
          )}
        </div>
      )}

      {/* ISI SUB-MENU 3: KHUSUS KATEGORI CABANG KBB (4 CABANG) */}
      {subMenuTab === 'kbb_only' && (
        <div className="space-y-5 animate-fade-in">
          {/* Kartu Visual 4 Cabang KBB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kbbOutlets.map((o, i) => (
              <div
                key={o.outletName}
                onClick={() => setInspectedOutlet(o)}
                className="rounded-2xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-400 p-5 shadow-xl cursor-pointer transition-all tabular-nums"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    #{i + 1} • {o.outletCode}
                  </span>
                  {renderTrendBadge(o.trend, o.selisihPct)}
                </div>
                <h4 className="text-base font-extrabold text-white mt-2">{o.outletName}</h4>
                <div className="text-xl font-extrabold text-emerald-400 mt-1.5">
                  {formatRupiah(o.omsetD1)}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>{o.trxD1} Trx Sukses</span>
                  <span>D2: {formatCompactRupiah(o.omsetD2)}</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1">
                  {(o.categoryBreakdown || []).slice(0, 3).map((cb) => (
                    <div
                      key={cb.categoryId}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-400 truncate">{cb.shortName}</span>
                      <span className="text-slate-200 font-semibold">
                        {formatCompactRupiah(cb.omsetD1)} ({cb.sharePct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {renderOutletTable(
            filteredKbbOutlets,
            `Daftar Kategori Outlet Cabang KBB (${filteredKbbOutlets.length} Cabang)`,
            'Jaringan cabang wilayah Bandung Barat (KBB Rawa 2, KBB Permata, KBB Kalapa, KBB Tanimulya). Klik baris untuk melihat rincian kategori produk.',
            '#10b981'
          )}
        </div>
      )}

      {/* ISI SUB-MENU 4: EVALUASI CABANG NAIK VS TURUN */}
      {subMenuTab === 'gainers_losers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Kolom Kiri: Cabang Naik */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Daftar Cabang yang Omsetnya NAIK ({outletGainers.length} Cabang)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Diurutkan dari kenaikan nominal Rupiah terbesar hari ini
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4 max-h-[540px] overflow-y-auto pr-1 tabular-nums">
              {outletGainers.map((o, idx) => (
                <div
                  key={o.outletName}
                  onClick={() => setInspectedOutlet(o)}
                  className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-emerald-500/40 cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        <span>{o.outletName}</span>
                        <span className="text-[10px] font-mono text-slate-400">({o.outletCode})</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {o.subCluster} • D1: {formatRupiah(o.omsetD1)} ({o.trxD1} Trx)
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-emerald-400">
                      +{formatRupiah(o.selisihRp)}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-500">
                      +{o.selisihPct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kolom Kanan: Cabang Turun */}
          <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Daftar Cabang yang Omsetnya TURUN ({outletLosers.length} Cabang)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cabang yang mengalami penurunan omset dibanding periode pembanding
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4 max-h-[540px] overflow-y-auto pr-1 tabular-nums">
              {outletLosers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Tidak ada cabang yang mengalami penurunan omset pada periode ini.
                </div>
              ) : (
                outletLosers.map((o, idx) => (
                  <div
                    key={o.outletName}
                    onClick={() => setInspectedOutlet(o)}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-rose-500/40 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{o.outletName}</span>
                          <span className="text-[10px] font-mono text-slate-400">({o.outletCode})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {o.subCluster} • D1: {formatRupiah(o.omsetD1)} ({o.trxD1} Trx)
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-rose-400">
                        {formatRupiah(o.selisihRp)}
                      </div>
                      <div className="text-[11px] font-bold text-rose-500">
                        {o.selisihPct}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ISI SUB-MENU 5: TABEL RANKING GABUNGAN SELURUH CABANG */}
      {subMenuTab === 'all_ranking' &&
        renderOutletTable(
          filteredAllOutlets,
          `Peringkat Gabungan Seluruh Cabang PLC & KBB (${filteredAllOutlets.length} Cabang)`,
          'Diurutkan dari cabang dengan Omset D1 tertinggi ke terendah.',
          '#6366f1'
        )}

      {/* 360° DEEP-DIVE SINGLE OUTLET INSPECTION MODAL (Rendered via Portal on document.body to avoid parent transform containing-block bug) */}
      {inspectedOutlet &&
        createPortal(
          <div
            onClick={() => setInspectedOutlet(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600/25 via-slate-900 to-slate-900 border-b border-indigo-500/30 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-extrabold text-white">
                        {inspectedOutlet.outletName}
                      </h3>
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        ID: {inspectedOutlet.outletCode}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                        {inspectedOutlet.subCluster || inspectedOutlet.groupName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Analisa Mendalam 360° Cabang ({period?.d1Label} vs {period?.d2Label}) • Jam Puncak: {inspectedOutlet.peakHour}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedOutlet(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Outlet KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 tabular-nums">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold">Omset Cabang D1</div>
                    <div className="text-lg font-extrabold text-white mt-1 whitespace-nowrap">
                      {formatRupiah(inspectedOutlet.omsetD1)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">
                      D2: {formatRupiah(inspectedOutlet.omsetD2)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold">Selisih Omset (DoD)</div>
                    <div
                      className={`text-lg font-extrabold mt-1 whitespace-nowrap ${
                        inspectedOutlet.selisihRp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {inspectedOutlet.selisihRp > 0 ? '+' : ''}
                      {formatRupiah(inspectedOutlet.selisihRp)}
                    </div>
                    <div className="mt-1">
                      {renderTrendBadge(inspectedOutlet.trend, inspectedOutlet.selisihPct)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold">Transaksi Sukses</div>
                    <div className="text-lg font-extrabold text-white mt-1">
                      {formatNumber(inspectedOutlet.trxD1)} Trx
                    </div>
                    <div className="text-[11px] text-emerald-400 mt-1">
                      Success Rate: {inspectedOutlet.successRateD1}% ({inspectedOutlet.gagalD1} Gagal)
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 uppercase font-semibold">Komisi & Jam Sibuk</div>
                    <div className="text-lg font-extrabold text-amber-300 mt-1 whitespace-nowrap">
                      {formatRupiah(inspectedOutlet.komisiD1)}
                    </div>
                    <div className="text-[11px] text-indigo-300 mt-1">
                      Puncak: {inspectedOutlet.peakHour}
                    </div>
                  </div>
                </div>

                {/* 5 Product Categories Breakdown in this Outlet */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Performa 5 Pilar Kategori Produk di {inspectedOutlet.outletName}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 whitespace-nowrap">
                          <th className="py-2 px-3">Kategori Produk</th>
                          <th className="py-2 px-3 text-right">Omset D1</th>
                          <th className="py-2 px-3 text-right">Omset D2</th>
                          <th className="py-2 px-3 text-right">Selisih (Rp)</th>
                          <th className="py-2 px-3 text-right">Trx D1</th>
                          <th className="py-2 px-3 text-right">Porsi Cabang</th>
                          <th className="py-2 px-3 text-center">Tren</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {(inspectedOutlet.categoryBreakdown || []).map((cb) => (
                          <tr key={cb.categoryId}>
                            <td className="py-2.5 px-3 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cb.color }}
                                />
                                <span>{cb.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                              {formatRupiah(cb.omsetD1)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                              {formatRupiah(cb.omsetD2)}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${
                                cb.selisihRp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {cb.selisihRp > 0 ? '+' : ''}
                              {formatRupiah(cb.selisihRp)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-200 whitespace-nowrap">{cb.trxD1}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-indigo-300 whitespace-nowrap">
                              {cb.sharePct}%
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {renderTrendBadge(cb.trend, cb.selisihPct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 24-Hour Activity Bar Chart + Top 12 Products in this Outlet */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Hourly Activity in this Outlet */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Distribusi Transaksi 24 Jam di Cabang Ini
                    </h4>
                    <div className="flex items-end gap-1 h-40 pt-4 px-1">
                      {(inspectedOutlet.hourlyComparison || []).map((h) => {
                        const maxTrx = Math.max(
                          1,
                          ...inspectedOutlet.hourlyComparison.map((x) => Math.max(x.trxD1, x.trxD2))
                        );
                        const h1Pct = Math.round((h.trxD1 / maxTrx) * 100);
                        return (
                          <div
                            key={h.hour}
                            className="flex-1 flex flex-col items-center justify-end h-full group relative"
                            title={`Jam ${h.label} — D1: ${h.trxD1} Trx (${formatRupiah(h.omsetD1)})`}
                          >
                            <div className="w-full bg-slate-900 rounded-t flex items-end justify-center h-28">
                              <div
                                className="w-full bg-indigo-500 group-hover:bg-cyan-400 rounded-t transition-all"
                                style={{ height: `${Math.max(h.trxD1 > 0 ? 8 : 0, h1Pct)}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-slate-500 mt-1">
                              {String(h.hour).padStart(2, '0')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Products in this Outlet */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-400" />
                      Top Produk Terlaris di {inspectedOutlet.outletName}
                    </h4>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 tabular-nums">
                      {(inspectedOutlet.topProducts || []).map((p, idx) => (
                        <div
                          key={p.produk}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono text-slate-500 w-4 shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="font-mono font-bold text-indigo-300 shrink-0">{p.produk}</span>
                            <span className="text-[11px] text-slate-400 truncate">({p.subCategory})</span>
                          </div>
                          <div className="text-right shrink-0 whitespace-nowrap ml-2">
                            <span className="font-bold text-white">{formatRupiah(p.omsetD1)}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{p.trxD1} Trx</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

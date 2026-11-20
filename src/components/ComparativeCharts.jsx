import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
} from 'lucide-react';
import {
  formatRupiah,
  formatCompactRupiah,
  formatNumber,
  formatPercent,
} from '../utils/format.js';

export default function ComparativeCharts({
  categoryComparison = [],
  hourlyComparison = [],
  peakHours = {},
  period = {},
  totalOmsetD1 = 0,
  totalTrxD1 = 0,
}) {
  // 1. State for Side-by-Side Bar Chart
  const [barMetric, setBarMetric] = useState('omset'); // 'omset' | 'trx' | 'laba'
  const [excludeTopOutlier, setExcludeTopOutlier] = useState(false);

  // 2. State for Donut Chart
  const [donutMetric, setDonutMetric] = useState('omset'); // 'omset' | 'trx' | 'laba'
  const [hoveredCatId, setHoveredCatId] = useState(null);

  // 3. State for Hourly Distribution Curve
  const [hourlyMetric, setHourlyMetric] = useState('trx'); // 'trx' | 'omset'
  const [hoveredHour, setHoveredHour] = useState(null);

  // Filtered categories for bar chart
  const barCategories = useMemo(() => {
    if (!excludeTopOutlier || categoryComparison.length <= 2) return categoryComparison;
    // Exclude Transfer Bank when user wants to zoom into E-Wallet, PPOB, Pulsa, Voucher
    return categoryComparison.filter((c) => c.categoryId !== 'cat_transfer_bank');
  }, [categoryComparison, excludeTopOutlier]);

  const maxBarValue = useMemo(() => {
    let max = 1;
    for (const c of barCategories) {
      const v1 = barMetric === 'omset' ? c.omsetD1 : barMetric === 'trx' ? c.trxD1 : c.labaD1;
      const v2 = barMetric === 'omset' ? c.omsetD2 : barMetric === 'trx' ? c.trxD2 : c.labaD2;
      if (v1 > max) max = v1;
      if (v2 > max) max = v2;
    }
    return max;
  }, [barCategories, barMetric]);

  // Donut Chart Calculations
  const donutData = useMemo(() => {
    const total = categoryComparison.reduce((acc, c) => {
      const val = donutMetric === 'omset' ? c.omsetD1 : donutMetric === 'trx' ? c.trxD1 : Math.max(0, c.labaD1);
      return acc + val;
    }, 0);

    let cumulativePct = 0;
    const segments = categoryComparison.map((c) => {
      const val = donutMetric === 'omset' ? c.omsetD1 : donutMetric === 'trx' ? c.trxD1 : Math.max(0, c.labaD1);
      const pct = total > 0 ? (val / total) * 100 : 0;
      const startPct = cumulativePct;
      cumulativePct += pct;
      return {
        ...c,
        value: val,
        pct,
        startPct,
      };
    });

    return { total, segments };
  }, [categoryComparison, donutMetric]);

  const activeDonutSegment = useMemo(() => {
    if (!hoveredCatId) return null;
    return donutData.segments.find((s) => s.categoryId === hoveredCatId) || null;
  }, [hoveredCatId, donutData]);

  // Hourly Chart SVG Geometry
  const hourlyChartGeometry = useMemo(() => {
    const width = 860;
    const height = 240;
    const padLeft = 48;
    const padRight = 20;
    const padTop = 22;
    const padBottom = 32;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    let maxVal = 10;
    for (const h of hourlyComparison) {
      const v1 = hourlyMetric === 'trx' ? h.trxD1 : h.omsetD1;
      const v2 = hourlyMetric === 'trx' ? h.trxD2 : h.omsetD2;
      if (v1 > maxVal) maxVal = v1;
      if (v2 > maxVal) maxVal = v2;
    }
    maxVal = Math.ceil(maxVal * 1.12);

    const pointsD1 = hourlyComparison.map((h, i) => {
      const val = hourlyMetric === 'trx' ? h.trxD1 : h.omsetD1;
      const x = padLeft + (i / 23) * innerW;
      const y = padTop + innerH - (val / maxVal) * innerH;
      return { x, y, val, hour: h.hour, label: h.label, raw: h };
    });

    const pointsD2 = hourlyComparison.map((h, i) => {
      const val = hourlyMetric === 'trx' ? h.trxD2 : h.omsetD2;
      const x = padLeft + (i / 23) * innerW;
      const y = padTop + innerH - (val / maxVal) * innerH;
      return { x, y, val, hour: h.hour, label: h.label, raw: h };
    });

    const buildSmoothPath = (pts) => {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        const cpx1 = p0.x + (p1.x - p0.x) * 0.45;
        const cpy1 = p0.y;
        const cpx2 = p0.x + (p1.x - p0.x) * 0.55;
        const cpy2 = p1.y;
        d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
      }
      return d;
    };

    const lineD1 = buildSmoothPath(pointsD1);
    const lineD2 = buildSmoothPath(pointsD2);
    const areaD1 =
      pointsD1.length > 0
        ? `${lineD1} L ${pointsD1[pointsD1.length - 1].x} ${padTop + innerH} L ${pointsD1[0].x} ${padTop + innerH} Z`
        : '';

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      innerW,
      innerH,
      maxVal,
      pointsD1,
      pointsD2,
      lineD1,
      lineD2,
      areaD1,
    };
  }, [hourlyComparison, hourlyMetric]);

  const activeHourData = useMemo(() => {
    if (hoveredHour !== null && hourlyComparison[hoveredHour]) {
      return hourlyComparison[hoveredHour];
    }
    return peakHours?.byTrxD1 || hourlyComparison[9] || null;
  }, [hoveredHour, hourlyComparison, peakHours]);

  return (
    <div className="space-y-6">
      {/* Row 1: Side-by-Side Category Bar Chart + Donut Proportion Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 7 Cols: Perbandingan Omset per Kategori (Side-by-Side Bar Chart) */}
        <div className="xl:col-span-7 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Perbandingan Performa per Kategori (Side-by-Side DoD)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Komparasi {period?.d1Label} (D1) vs {period?.d2Label} (D2)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {barMetric === 'omset' && (
                  <button
                    type="button"
                    onClick={() => setExcludeTopOutlier(!excludeTopOutlier)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      excludeTopOutlier
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                    title="Sembunyikan sementara Transfer Bank agar grafik kategori lain terlihat lebih detail"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {excludeTopOutlier ? 'Tampilkan Semua' : 'Zoom Non-Bank'}
                  </button>
                )}

                <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                  {[
                    { id: 'omset', label: 'Omset (Rp)' },
                    { id: 'trx', label: 'Transaksi' },
                    { id: 'laba', label: 'Laba' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setBarMetric(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        barMetric === tab.id
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-xs text-slate-400 mt-3 mb-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                  <strong className="text-slate-200">D1 ({period?.d1Label})</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" />
                  <span>D2 ({period?.d2Label})</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Hover baris kategori untuk melihat detail rasio
              </span>
            </div>

            {/* Side-by-Side Horizontal Grouped Bars */}
            <div className="space-y-4">
              {barCategories.map((cat) => {
                const v1 =
                  barMetric === 'omset' ? cat.omsetD1 : barMetric === 'trx' ? cat.trxD1 : Math.max(0, cat.labaD1);
                const v2 =
                  barMetric === 'omset' ? cat.omsetD2 : barMetric === 'trx' ? cat.trxD2 : Math.max(0, cat.labaD2);
                const pct1 = Math.max(2, Math.min(100, (v1 / maxBarValue) * 100));
                const pct2 = Math.max(2, Math.min(100, (v2 / maxBarValue) * 100));

                const diffVal = v1 - v2;
                const diffPct = v2 > 0 ? ((v1 - v2) / v2) * 100 : v1 > 0 ? 100 : 0;
                const isUp = diffVal >= 0;

                return (
                  <div
                    key={cat.categoryId}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 transition-all group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || '#6366f1' }}
                        />
                        <span className="text-xs font-bold text-slate-100">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums text-xs">
                        <span className="font-semibold text-white">
                          {barMetric === 'trx' ? `${formatNumber(v1)} Trx` : formatRupiah(v1)}
                        </span>
                        <span className="text-slate-500">vs</span>
                        <span className="text-slate-400">
                          {barMetric === 'trx' ? `${formatNumber(v2)} Trx` : formatCompactRupiah(v2)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isUp
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {formatPercent(diffPct)}
                        </span>
                      </div>
                    </div>

                    {/* Dual Bars: D1 and D2 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-[10px] font-mono font-bold text-indigo-300">D1</span>
                        <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct1}%`,
                              backgroundColor: cat.color || '#6366f1',
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-[10px] font-mono text-slate-500">D2</span>
                        <div className="flex-1 h-2.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-slate-600/80 transition-all duration-500"
                            style={{ width: `${pct2}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Proporsi Kontribusi Kategori (Donut Chart) */}
        <div className="xl:col-span-5 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <PieChartIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Proporsi Kontribusi Kategori</h3>
                  <p className="text-xs text-slate-400">Distribusi porsi pada {period?.d1Label} (D1)</p>
                </div>
              </div>

              <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                {[
                  { id: 'omset', label: 'Omset' },
                  { id: 'trx', label: 'Volume Trx' },
                  { id: 'laba', label: 'Laba' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDonutMetric(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      donutMetric === tab.id
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive SVG Donut Chart */}
            <div className="my-5 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 transform">
                  <circle
                    cx="60"
                    cy="60"
                    r="46"
                    fill="transparent"
                    stroke="#1e293b"
                    strokeWidth="16"
                  />
                  {donutData.segments.map((seg) => {
                    const circumference = 2 * Math.PI * 46;
                    const strokeDasharray = `${(seg.pct / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((seg.startPct / 100) * circumference);
                    const isHovered = hoveredCatId === seg.categoryId;

                    return (
                      <circle
                        key={seg.categoryId}
                        cx="60"
                        cy="60"
                        r="46"
                        fill="transparent"
                        stroke={seg.color || '#6366f1'}
                        strokeWidth={isHovered ? '20' : '16'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredCatId(seg.categoryId)}
                        onMouseLeave={() => setHoveredCatId(null)}
                      />
                    );
                  })}
                </svg>

                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 line-clamp-1">
                    {activeDonutSegment ? activeDonutSegment.shortName : `Total ${donutMetric === 'trx' ? 'Trx' : donutMetric === 'laba' ? 'Laba' : 'Omset'}`}
                  </span>
                  <span className="text-sm font-extrabold text-white mt-0.5 tabular-nums">
                    {activeDonutSegment
                      ? `${activeDonutSegment.pct.toFixed(1)}%`
                      : donutMetric === 'trx'
                      ? `${formatNumber(donutData.total)}`
                      : formatCompactRupiah(donutData.total)}
                  </span>
                  {activeDonutSegment && (
                    <span className="text-[10px] text-slate-300 mt-0.5 tabular-nums">
                      {donutMetric === 'trx'
                        ? `${formatNumber(activeDonutSegment.value)} Trx`
                        : formatCompactRupiah(activeDonutSegment.value)}
                    </span>
                  )}
                </div>
              </div>

              {/* Legend List */}
              <div className="flex-1 w-full space-y-2">
                {donutData.segments.map((seg) => (
                  <div
                    key={seg.categoryId}
                    onMouseEnter={() => setHoveredCatId(seg.categoryId)}
                    onMouseLeave={() => setHoveredCatId(null)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      hoveredCatId === seg.categoryId
                        ? 'bg-slate-800 border-slate-600'
                        : 'bg-slate-950/50 border-slate-800/70 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {seg.shortName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                      <span className="text-xs text-slate-400">
                        {donutMetric === 'trx'
                          ? `${formatNumber(seg.value)} Trx`
                          : formatCompactRupiah(seg.value)}
                      </span>
                      <span className="text-xs font-bold text-white w-12 text-right">
                        {seg.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Total Omset D1: <strong className="text-slate-200">{formatRupiah(totalOmsetD1)}</strong></span>
            <span>Total Sukses D1: <strong className="text-slate-200">{formatNumber(totalTrxD1)} Trx</strong></span>
          </div>
        </div>
      </div>

      {/* Row 2: Analisis Jam Sibuk (Hourly Distribution 00:00 - 23:00) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Analisis Jam Sibuk & Pergerakan Transaksi Per Jam (00:00 – 23:00)
              </h3>
              <p className="text-xs text-slate-400">
                Kurva perbandingan trafik jam puncak antara {period?.d1Label} (D1) vs {period?.d2Label} (D2)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Peak Hour Badges */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Jam Puncak D1:</span>
              <span className="font-mono font-bold text-amber-300">
                {peakHours?.byTrxD1?.label || '-'} ({formatNumber(peakHours?.byTrxD1?.trxD1 || 0)} Trx)
              </span>
            </div>

            <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setHourlyMetric('trx')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  hourlyMetric === 'trx'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Frekuensi Transaksi
              </button>
              <button
                type="button"
                onClick={() => setHourlyMetric('omset')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  hourlyMetric === 'omset'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Nilai Omset (Rp)
              </button>
            </div>
          </div>
        </div>

        {/* Selected / Hovered Hour Inspection Bar */}
        {activeHourData && (
          <div className="mt-4 mb-2 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                Pukul {activeHourData.label} – {String(activeHourData.hour).padStart(2, '0')}:59
              </span>
              <span className="text-slate-400">
                {hoveredHour !== null ? 'Detail Jam yang Dipilih' : 'Sorotan Jam Puncak (Arahkan kursor ke grafik untuk jam lain)'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-5 tabular-nums">
              <div>
                <span className="text-slate-400">Trx D1 vs D2: </span>
                <strong className="text-emerald-400">{formatNumber(activeHourData.trxD1)} Trx</strong>
                <span className="text-slate-500"> / {formatNumber(activeHourData.trxD2)} Trx</span>
              </div>
              <div>
                <span className="text-slate-400">Omset D1 vs D2: </span>
                <strong className="text-white">{formatRupiah(activeHourData.omsetD1)}</strong>
                <span className="text-slate-500"> / {formatCompactRupiah(activeHourData.omsetD2)}</span>
              </div>
              <div>
                <span className="text-slate-400">Laba Jam Ini: </span>
                <strong className="text-indigo-300">{formatRupiah(activeHourData.labaD1)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* SVG Curve Chart */}
        <div className="w-full overflow-x-auto pt-2">
          <div className="min-w-[680px]">
            <svg
              viewBox={`0 0 ${hourlyChartGeometry.width} ${hourlyChartGeometry.height}`}
              className="w-full h-60 select-none overflow-visible"
            >
              <defs>
                <linearGradient id="hourlyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y =
                  hourlyChartGeometry.padTop +
                  hourlyChartGeometry.innerH -
                  ratio * hourlyChartGeometry.innerH;
                const val = Math.round(ratio * hourlyChartGeometry.maxVal);
                return (
                  <g key={idx}>
                    <line
                      x1={hourlyChartGeometry.padLeft}
                      y1={y}
                      x2={hourlyChartGeometry.width - hourlyChartGeometry.padRight}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray={ratio === 0 ? '' : '4 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={hourlyChartGeometry.padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[10px] font-mono"
                    >
                      {hourlyMetric === 'trx' ? val : formatCompactRupiah(val).replace('Rp ', '')}
                    </text>
                  </g>
                );
              })}

              {/* D1 Area Fill */}
              <path d={hourlyChartGeometry.areaD1} fill="url(#hourlyAreaGrad)" />

              {/* D2 Dashed Comparison Line */}
              <path
                d={hourlyChartGeometry.lineD2}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="5 4"
              />

              {/* D1 Solid Primary Line */}
              <path
                d={hourlyChartGeometry.lineD1}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
              />

              {/* Interactive Hourly Columns & Data Points */}
              {hourlyChartGeometry.pointsD1.map((pt, i) => {
                const pt2 = hourlyChartGeometry.pointsD2[i];
                const isHovered = hoveredHour === pt.hour;
                const isPeak = peakHours?.byTrxD1?.hour === pt.hour && hourlyMetric === 'trx';

                return (
                  <g
                    key={pt.hour}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredHour(pt.hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                  >
                    {/* Hover Vertical Guide */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={hourlyChartGeometry.padTop}
                        x2={pt.x}
                        y2={hourlyChartGeometry.padTop + hourlyChartGeometry.innerH}
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Invisible wide hit target for easy hover */}
                    <rect
                      x={pt.x - hourlyChartGeometry.innerW / 48}
                      y={hourlyChartGeometry.padTop}
                      width={hourlyChartGeometry.innerW / 24}
                      height={hourlyChartGeometry.innerH + 24}
                      fill="transparent"
                    />

                    {/* D2 Point */}
                    {pt2 && (
                      <circle
                        cx={pt2.x}
                        cy={pt2.y}
                        r={isHovered ? 4.5 : 2.5}
                        fill="#475569"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* D1 Point */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : isPeak ? 5 : 3.5}
                      fill={isPeak ? '#f59e0b' : '#10b981'}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />

                    {/* Hour X-axis Label */}
                    <text
                      x={pt.x}
                      y={hourlyChartGeometry.height - 8}
                      textAnchor="middle"
                      className={`text-[10px] font-mono ${
                        isHovered
                          ? 'fill-emerald-400 font-bold'
                          : isPeak
                          ? 'fill-amber-400 font-bold'
                          : 'fill-slate-400'
                      }`}
                    >
                      {String(pt.hour).padStart(2, '0')}:00
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  UserCheck,
  Users,
  Repeat,
  Crown,
  GitBranch,
  Store,
  Search,
  Calendar,
  Clock,
  Copy,
  Check,
  Download,
  MessageSquareShare,
  Eye,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Info,
  Sparkles,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';
import { apiFetch } from '../utils/api.js';
import {
  formatRupiah,
  formatCompactRupiah,
  formatNumber,
  formatShortDateIndo,
  useAnimatedNumber,
} from '../utils/format.js';

const SEGMENT_BADGE_CLASSES = {
  vip_power: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  rutin_harian: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  rutin_mingguan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  repeat_harian: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  reguler: 'bg-slate-800 text-slate-300 border-slate-700',
};

const SEGMENT_LABELS = {
  vip_power: 'VIP / Power',
  rutin_harian: 'Rutin Lintas Hari',
  rutin_mingguan: 'Rutin Mingguan',
  repeat_harian: 'Repeat Harian',
  reguler: 'Reguler',
};

export default function CustomerHabitView({
  datesSummary = [],
  defaultDate = '',
  initialOutlet = 'ALL',
  onClearInitialOutlet,
  onToast,
}) {
  const sortedDatesAsc = useMemo(
    () => [...datesSummary].map((d) => d.date).sort((a, b) => a.localeCompare(b)),
    [datesSummary]
  );
  const latestAvailableDate = sortedDatesAsc[sortedDatesAsc.length - 1] || '';
  const oldestAvailableDate = sortedDatesAsc[0] || '';

  const [periodMode, setPeriodMode] = useState(() =>
    datesSummary.length <= 1 ? 'daily' : 'weekly'
  );
  const [selectedDate, setSelectedDate] = useState(
    () => defaultDate || datesSummary[0]?.date || ''
  );
  const [customStartDate, setCustomStartDate] = useState(() => oldestAvailableDate);
  const [customEndDate, setCustomEndDate] = useState(() => latestAvailableDate);

  const [groupFilter, setGroupFilter] = useState('ALL');
  const [outletFilter, setOutletFilter] = useState(initialOutlet || 'ALL');
  const [segmentFilter, setSegmentFilter] = useState('ALL');
  const [minTrx, setMinTrx] = useState(2);
  const [sortBy, setSortBy] = useState('trx_desc');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [viewTab, setViewTab] = useState('customers'); // 'customers' | 'outlets'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [habitData, setHabitData] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [waCopied, setWaCopied] = useState(false);

  const [detailModal, setDetailModal] = useState({
    open: false,
    loading: false,
    data: null,
    tujuan: '',
    error: null,
  });

  // Sync default dates when bootstrap loads
  useEffect(() => {
    if (!selectedDate && (defaultDate || latestAvailableDate)) {
      setSelectedDate(defaultDate || latestAvailableDate);
    }
    if (!customStartDate && oldestAvailableDate) {
      setCustomStartDate(oldestAvailableDate);
    }
    if (!customEndDate && latestAvailableDate) {
      setCustomEndDate(latestAvailableDate);
    }
  }, [defaultDate, latestAvailableDate, oldestAvailableDate, selectedDate, customStartDate, customEndDate]);

  // Sync initialOutlet when navigated from OutletAnalyticsView / OutletMapView
  useEffect(() => {
    if (initialOutlet && initialOutlet !== 'ALL') {
      setOutletFilter(initialOutlet);
      setGroupFilter('ALL');
      setViewTab('customers');
      setPage(1);
    }
  }, [initialOutlet]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchCustomerHabits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        periodMode,
        group: groupFilter,
        outlet: outletFilter,
        segment: segmentFilter,
        minTrx: String(minTrx),
        search: searchQuery,
        sortBy,
        page: String(page),
        limit: '50',
      });
      if (periodMode === 'daily' && selectedDate) {
        params.set('date', selectedDate);
      } else if (periodMode === 'custom') {
        if (customStartDate) params.set('startDate', customStartDate);
        if (customEndDate) params.set('endDate', customEndDate);
      } else if (periodMode === 'weekly' && latestAvailableDate) {
        params.set('endDate', latestAvailableDate);
      }

      const res = await apiFetch(`/api/customer-habits?${params.toString()}`);
      if (res.status === 401) return;
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data analisa kebiasaan pelanggan.');
      }
      setHabitData(data);
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memuat data.');
    } finally {
      setLoading(false);
    }
  }, [
    periodMode,
    selectedDate,
    customStartDate,
    customEndDate,
    latestAvailableDate,
    groupFilter,
    outletFilter,
    segmentFilter,
    minTrx,
    searchQuery,
    sortBy,
    page,
  ]);

  useEffect(() => {
    fetchCustomerHabits();
  }, [fetchCustomerHabits]);

  const openCustomerDetail = async (tujuan) => {
    if (!tujuan) return;
    setDetailModal({ open: true, loading: true, data: null, tujuan, error: null });
    try {
      const params = new URLSearchParams({
        tujuan,
        periodMode,
      });
      if (periodMode === 'daily' && selectedDate) {
        params.set('date', selectedDate);
      } else if (periodMode === 'custom') {
        if (customStartDate) params.set('startDate', customStartDate);
        if (customEndDate) params.set('endDate', customEndDate);
      } else if (periodMode === 'weekly' && latestAvailableDate) {
        params.set('endDate', latestAvailableDate);
      }
      const res = await apiFetch(`/api/customer-habits/detail?${params.toString()}`);
      if (res.status === 401) return;
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat detail nomor tujuan.');
      }
      setDetailModal({ open: true, loading: false, data, tujuan, error: null });
    } catch (err) {
      setDetailModal({
        open: true,
        loading: false,
        data: null,
        tujuan,
        error: err.message || 'Gagal memuat detail.',
      });
    }
  };

  const copyText = async (text, keyLabel) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(keyLabel);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  const summary = habitData?.summary || {};
  const customers = habitData?.customers || [];
  const pagination = habitData?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 };
  const outletSummaries = habitData?.outletSummaries || [];
  const availableOutlets = habitData?.availableOutlets || [];

  const animUnique = useAnimatedNumber(summary.totalUniqueCustomers || 0);
  const animRepeat = useAnimatedNumber(summary.repeatCustomersCount || 0);
  const animVip = useAnimatedNumber(summary.powerCustomersCount || 0);
  const animMulti = useAnimatedNumber(summary.multiOutletCustomersCount || 0);

  const handleCopyWaHabitSummary = async () => {
    if (!habitData) return;
    const topCusts = customers.slice(0, 8);
    const topOutlets = outletSummaries.slice(0, 5);
    const lines = [
      `👥 *ANALISA HABIT PELANGGAN PER OUTLET*`,
      `📅 *Periode*: ${summary.periodLabel || '-'}`,
      outletFilter !== 'ALL' ? `🏪 *Filter Outlet*: ${outletFilter}` : `🏪 *Cakupan*: ${groupFilter === 'ALL' ? 'Semua Outlet & Reseller' : groupFilter}`,
      ``,
      `*=== RINGKASAN KEBIASAAN ===*`,
      `• Pelanggan Unik: ${formatNumber(summary.totalUniqueCustomers || 0)} nomor (${formatNumber(summary.totalSuksesTrx || 0)} Trx)`,
      `• Pelanggan Repeat (≥2x): *${formatNumber(summary.repeatCustomersCount || 0)} nomor* (${summary.repeatRatePct || 0}% dari pelanggan)`,
      `• Kontribusi Transaksi Repeat: ${summary.repeatTrxSharePct || 0}% trx (${summary.repeatOmsetSharePct || 0}% omset)`,
      `• Pelanggan VIP / Power: ${formatNumber(summary.powerCustomersCount || 0)} nomor`,
      `• Pelanggan Lintas Outlet: ${formatNumber(summary.multiOutletCustomersCount || 0)} nomor`,
      ``,
      `*=== TOP NOMOR PALING SERING TRANSAKSI ===*`,
    ];

    topCusts.forEach((c, idx) => {
      lines.push(
        `${idx + 1}. *${c.tujuan}* (${c.primaryOutlet}) — *${c.totalTrx}x* / ${c.activeDays} hari | ${formatRupiah(c.totalOmset)} | ${c.topProduct} | Jam ${c.peakHour}`
      );
    });

    if (topOutlets.length > 0 && outletFilter === 'ALL') {
      lines.push(``, `*=== OUTLET DENGAN PELANGGAN REPEAT TERBANYAK ===*`);
      topOutlets.forEach((o, idx) => {
        const topNum = o.topFrequentNumbers?.[0];
        lines.push(
          `${idx + 1}. *${o.outletName}*: ${o.repeatCustomers} repeat (${o.repeatRatePct}%) • Tersering: ${topNum ? `${topNum.tujuan} (${topNum.trx}x)` : '-'}`
        );
      });
    }

    await copyText(lines.join('\n'), 'wa_summary');
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2500);
    onToast?.('Ringkasan Habit Pelanggan siap kirim WhatsApp berhasil disalin!');
  };

  const handleExportCsv = () => {
    if (!customers.length) {
      onToast?.('Tidak ada data nomor pelanggan untuk diekspor.', 'warning');
      return;
    }
    const headers = [
      'No',
      'Nomor Tujuan',
      'Tipe Nomor',
      'Outlet Utama',
      'Klaster',
      'Loyalitas (%)',
      'Jumlah Outlet',
      'Total Trx',
      'Hari Aktif',
      'Maks Trx/Hari',
      'Estimasi Trx/Minggu',
      'Segmen Habit',
      'Shift Dominan',
      'Jam Puncak',
      'Hari Favorit',
      'Kategori Favorit',
      'Produk Favorit',
      'Total Omset',
      'Rata-rata Tiket',
    ];
    const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = customers.map((c, idx) =>
      [
        (pagination.page - 1) * pagination.limit + idx + 1,
        c.tujuan,
        c.customerType,
        c.primaryOutlet,
        c.primaryOutletSubCluster,
        c.loyaltyPct,
        c.globalOutletCount,
        c.totalTrx,
        c.activeDays,
        c.maxTrxInOneDay,
        c.estimatedPerWeek,
        c.habitLabel,
        c.dominantTimeSlot,
        c.peakHour,
        c.favoriteDayOfWeek,
        c.topCategory,
        c.topProduct,
        c.totalOmset,
        c.avgTicketSize,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habit-pelanggan-${periodMode}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onToast?.(`Berhasil mengekspor ${customers.length} data habit pelanggan ke CSV.`);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/40 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">
                  Analisa Habit & Kebiasaan Pelanggan per Outlet
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Harian & Mingguan
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                Lacak nomor HP, akun E-Wallet, atau nomor rekening yang paling sering bertransaksi di setiap outlet,
                lengkap dengan frekuensi per hari/minggu, jam kedatangan favorit, produk langganan, serta pelanggan lintas cabang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWaHabitSummary}
              disabled={!habitData}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                waCopied
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {waCopied ? <Check className="w-3.5 h-3.5" /> : <MessageSquareShare className="w-3.5 h-3.5" />}
              <span>{waCopied ? 'Tersalin!' : 'Salin Ringkasan WA'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!customers.length}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Period Selector Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-950/90 p-1 border border-slate-800">
              {[
                { id: 'daily', label: 'Harian (1 Hari)' },
                { id: 'weekly', label: 'Mingguan (7 Hari)' },
                { id: 'all', label: 'Semua Data' },
                { id: 'custom', label: 'Rentang Kustom' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPeriodMode(m.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    periodMode === m.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {periodMode === 'daily' && (
              <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Tanggal:</span>
                <select
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  {datesSummary.map((d) => (
                    <option key={d.date} value={d.date} className="bg-slate-900 text-white">
                      {formatShortDateIndo(d.date)} ({formatNumber(d.suksesTrx)} Trx)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  {sortedDatesAsc.map((d) => (
                    <option key={d} value={d} className="bg-slate-900 text-white">
                      {formatShortDateIndo(d)}
                    </option>
                  ))}
                </select>
                <span className="text-slate-500">s/d</span>
                <select
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  {sortedDatesAsc.map((d) => (
                    <option key={d} value={d} className="bg-slate-900 text-white">
                      {formatShortDateIndo(d)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-semibold">
              Periode Aktif: <strong className="text-white">{summary.periodLabel || '-'}</strong>
            </span>
            <button
              type="button"
              onClick={fetchCustomerHabits}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300"
              title="Muat Ulang Analisa"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Helpful Info Notice when weekly window has < 7 uploaded days */}
        {periodMode === 'weekly' && (summary.totalDaysInPeriod || 0) < 7 && (
          <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2.5 text-xs text-cyan-200">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Saat ini tersedia <strong>{summary.totalDaysInPeriod || datesSummary.length} hari data transaksi</strong> di database lokal.
              Unggah file Excel harian tambahan pada menu <strong>Upload Excel & Kalender</strong> untuk melihat pola mingguan (7 hari penuh) secara otomatis.
            </span>
          </div>
        )}
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pelanggan Unik
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            {formatNumber(animUnique)} <span className="text-sm font-semibold text-slate-400">nomor</span>
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            Dari <strong className="text-slate-200">{formatNumber(summary.totalSuksesTrx || 0)}</strong> Trx Sukses ({formatCompactRupiah(summary.totalOmset || 0)})
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Pelanggan Repeat (≥2x)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-2">
            {formatNumber(animRepeat)} <span className="text-sm font-semibold text-slate-300">({summary.repeatRatePct || 0}%)</span>
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            Menyumbang <strong className="text-emerald-300">{summary.repeatTrxSharePct || 0}%</strong> Trx & <strong className="text-emerald-300">{summary.repeatOmsetSharePct || 0}%</strong> Omset
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Pelanggan VIP / Power
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-300 mt-2">
            {formatNumber(animVip)} <span className="text-sm font-semibold text-slate-400">nomor</span>
          </div>
          <div className="text-xs text-slate-400 mt-1.5 truncate">
            {summary.topCustomer ? (
              <>
                #1: <strong className="font-mono text-white">{summary.topCustomer.tujuan}</strong> ({summary.topCustomer.totalTrx}x di {summary.topCustomer.primaryOutlet})
              </>
            ) : (
              'Belum ada pelanggan VIP'
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Pelanggan Lintas Outlet
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <GitBranch className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-cyan-300 mt-2">
            {formatNumber(animMulti)} <span className="text-sm font-semibold text-slate-400">nomor</span>
          </div>
          <div className="text-xs text-slate-400 mt-1.5">
            Rata-rata <strong className="text-white">{summary.avgTrxPerCustomer || 0}x</strong> transaksi / pelanggan
          </div>
        </div>
      </div>

      {/* Main Sub-Tabs & Active Outlet Chip */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2 shadow-lg flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewTab('customers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              viewTab === 'customers'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-950/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>1. Daftar Nomor Pelanggan & Habit</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${viewTab === 'customers' ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'}`}>
              {formatNumber(pagination.total || 0)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab('outlets')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              viewTab === 'outlets'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-950/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>2. Ringkasan Kebiasaan per Outlet</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${viewTab === 'outlets' ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'}`}>
              {outletSummaries.length} Outlet
            </span>
          </button>
        </div>

        {outletFilter !== 'ALL' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-xs">
            <Store className="w-3.5 h-3.5 text-indigo-300" />
            <span className="text-slate-300">Outlet:</span>
            <strong className="text-white">{outletFilter}</strong>
            <button
              type="button"
              onClick={() => {
                setOutletFilter('ALL');
                setPage(1);
                onClearInitialOutlet?.();
              }}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              title="Reset Filter Outlet"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* TAB 1: CUSTOMER LIST & HABITS */}
      {viewTab === 'customers' && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
          {/* Filter Controls Bar */}
          <div className="p-5 border-b border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* Group Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Kelompok Outlet
                </label>
                <select
                  value={groupFilter}
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setOutletFilter('ALL');
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">Semua Kelompok</option>
                  <option value="OFFICIAL">Cabang Resmi (PLC & KBB)</option>
                  <option value="out_plc">Cabang PLC</option>
                  <option value="out_kbb">Cabang KBB</option>
                  <option value="non_plc_kbb">Reseller Non-PLC/KBB</option>
                </select>
              </div>

              {/* Specific Outlet */}
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Filter Outlet Spesifik
                </label>
                <select
                  value={outletFilter}
                  onChange={(e) => {
                    setOutletFilter(e.target.value);
                    setPage(1);
                    if (e.target.value === 'ALL') onClearInitialOutlet?.();
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">Semua Outlet ({availableOutlets.length} Outlet)</option>
                  {availableOutlets.map((o) => (
                    <option key={o.outletName} value={o.outletName}>
                      {o.outletName} ({formatNumber(o.totalTrx)} Trx)
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Frequency */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Minimal Transaksi
                </label>
                <select
                  value={minTrx}
                  onChange={(e) => {
                    setMinTrx(Number(e.target.value));
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value={2}>Repeat (≥ 2x)</option>
                  <option value={3}>Sering (≥ 3x)</option>
                  <option value={5}>Sangat Sering (≥ 5x)</option>
                  <option value={1}>Semua Nomor (≥ 1x)</option>
                </select>
              </div>

              {/* Segment Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Segmen Kebiasaan
                </label>
                <select
                  value={segmentFilter}
                  onChange={(e) => {
                    setSegmentFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ALL">Semua Segmen</option>
                  <option value="vip_power">VIP / Power User</option>
                  <option value="rutin_harian">Rutin Lintas Hari</option>
                  <option value="rutin_mingguan">Rutin Mingguan</option>
                  <option value="repeat_harian">Repeat Harian</option>
                  <option value="multi_outlet">Lintas Outlet (&gt;1 Cabang)</option>
                  <option value="reguler">Reguler</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Urutkan
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="trx_desc">Transaksi Terbanyak</option>
                  <option value="omset_desc">Omset Terbesar</option>
                  <option value="active_days_desc">Hari Aktif Terbanyak</option>
                  <option value="avg_per_day_desc">Puncak Trx/Hari</option>
                  <option value="multi_outlet_desc">Outlet Terbanyak</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nomor tujuan (HP / E-Wallet / Rekening), nama outlet, kode produk favorit..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Customer Habit Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  <th className="py-3.5 px-4 w-12">No</th>
                  <th className="py-3.5 px-4 min-w-[190px]">Nomor Tujuan & Tipe</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Outlet Utama & Loyalitas</th>
                  <th className="py-3.5 px-3 text-center">Frekuensi</th>
                  <th className="py-3.5 px-3 text-center">Segmen Habit</th>
                  <th className="py-3.5 px-4 min-w-[165px]">Pola Waktu</th>
                  <th className="py-3.5 px-4 min-w-[155px]">Produk Favorit</th>
                  <th className="py-3.5 px-4 text-right">Total Omset</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 mx-auto mb-2" />
                      Menganalisa kebiasaan transaksi pelanggan...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Tidak ditemukan nomor pelanggan yang cocok dengan filter saat ini. Coba turunkan batas <strong>Minimal Transaksi</strong>.
                    </td>
                  </tr>
                ) : (
                  customers.map((c, idx) => {
                    const rank = (pagination.page - 1) * pagination.limit + idx + 1;
                    const badgeCls = SEGMENT_BADGE_CLASSES[c.habitSegment] || SEGMENT_BADGE_CLASSES.reguler;
                    return (
                      <tr
                        key={`${c.tujuan}_${rank}`}
                        onClick={() => openCustomerDetail(c.tujuan)}
                        className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-400">#{rank}</td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-sm text-white">
                              {c.tujuan}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(c.tujuan, `num_${c.tujuan}`);
                              }}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                              title="Salin Nomor Tujuan"
                            >
                              {copiedKey === `num_${c.tujuan}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>{c.customerType}</span>
                            {c.isMultiOutlet && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                                {c.globalOutletCount} Outlet
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{c.primaryOutlet}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>Loyalitas {c.loyaltyPct}%</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-indigo-300">{c.primaryOutletSubCluster}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="text-sm font-extrabold text-indigo-300">
                            {c.totalTrx}x Trx
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {c.activeDays} hari • Maks {c.maxTrxInOneDay}x/hr
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeCls}`}>
                            {SEGMENT_LABELS[c.habitSegment] || c.habitLabel}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-cyan-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Puncak {c.peakHour}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {c.dominantTimeSlot} • {c.favoriteDayOfWeek}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-emerald-300">{c.topProduct}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[170px]">
                            {c.topCategory}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-extrabold text-white">{formatRupiah(c.totalOmset)}</div>
                          <div className="text-[11px] text-slate-400">
                            Avg: {formatCompactRupiah(c.avgTicketSize)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCustomerDetail(c.tujuan);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-bold transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Habit 360°</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Menampilkan <strong className="text-white">{customers.length}</strong> dari{' '}
              <strong className="text-white">{formatNumber(pagination.total || 0)}</strong> nomor pelanggan
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>
              <span className="px-2 font-bold text-white">
                Hal {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OUTLET HABIT SUMMARY */}
      {viewTab === 'outlets' && (
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-white">
                Ringkasan Kebiasaan Pelanggan per Outlet ({outletSummaries.length} Outlet)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Diurutkan dari outlet dengan jumlah pelanggan repeat (≥2x) terbanyak. Klik nomor untuk melihat Habit 360°.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={groupFilter}
                onChange={(e) => {
                  setGroupFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-none"
              >
                <option value="ALL">Semua Kelompok</option>
                <option value="OFFICIAL">Cabang Resmi (PLC & KBB)</option>
                <option value="out_plc">Cabang PLC</option>
                <option value="out_kbb">Cabang KBB</option>
                <option value="non_plc_kbb">Reseller Non-PLC/KBB</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  <th className="py-3.5 px-4 w-12">No</th>
                  <th className="py-3.5 px-4 min-w-[210px]">Outlet & Klaster</th>
                  <th className="py-3.5 px-3 text-right">Pelanggan Unik</th>
                  <th className="py-3.5 px-3 text-right">Repeat (≥2x)</th>
                  <th className="py-3.5 px-3 text-center">Repeat Rate</th>
                  <th className="py-3.5 px-3 text-center">Porsi Trx Repeat</th>
                  <th className="py-3.5 px-4">Waktu & Kategori Dominan</th>
                  <th className="py-3.5 px-4 min-w-[290px]">Top 5 Nomor Paling Sering</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {outletSummaries.map((o, idx) => (
                  <tr key={o.outletName} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-400">#{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-sm">{o.outletName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {o.outletCode} • {o.subCluster} • {formatNumber(o.totalTrx)} Trx
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-white">
                      {formatNumber(o.uniqueCustomers)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-extrabold text-emerald-400">
                      {formatNumber(o.repeatCustomers)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {o.repeatRatePct}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold text-indigo-300">
                      {o.repeatTrxSharePct}%
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-cyan-300 font-semibold">{o.dominantTimeSlot}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{o.topCategory}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(o.topFrequentNumbers || []).map((num) => (
                          <button
                            key={num.tujuan}
                            type="button"
                            onClick={() => openCustomerDetail(num.tujuan)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 hover:bg-indigo-600/30 border border-slate-800 hover:border-indigo-500/50 text-[11px] transition-all"
                            title={`${num.tujuan}: ${num.trx}x Trx (${formatRupiah(num.omset)}) • ${num.topProduct}`}
                          >
                            <span className="font-mono font-bold text-white">{num.tujuan}</span>
                            <span className="px-1 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                              {num.trx}x
                            </span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setOutletFilter(o.outletName);
                          setMinTrx(2);
                          setViewTab('customers');
                          setPage(1);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-bold transition-all"
                      >
                        <span>Lihat Semua Nomor</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOMER HABIT 360° DETAIL MODAL */}
      {detailModal.open &&
        createPortal(
          <div
            onClick={() => setDetailModal({ open: false, loading: false, data: null, tujuan: '', error: null })}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-600/25 via-slate-900 to-slate-900 border-b border-indigo-500/30 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-extrabold font-mono text-white">
                        {detailModal.tujuan}
                      </h3>
                      {detailModal.data?.profile && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            SEGMENT_BADGE_CLASSES[detailModal.data.profile.habitSegment] ||
                            SEGMENT_BADGE_CLASSES.reguler
                          }`}
                        >
                          {detailModal.data.profile.habitLabel}
                        </span>
                      )}
                      {detailModal.data?.profile?.customerType && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300">
                          {detailModal.data.profile.customerType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Analisa Habit 360° Pelanggan • Periode: {detailModal.data?.periodLabel || '-'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModal({ open: false, loading: false, data: null, tujuan: '', error: null })}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {detailModal.loading ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
                    Memuat detail kebiasaan nomor {detailModal.tujuan}...
                  </div>
                ) : detailModal.error ? (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                    {detailModal.error}
                  </div>
                ) : detailModal.data?.profile ? (
                  <>
                    {/* Habit Insight Callout */}
                    <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-200 leading-relaxed">
                        <div className="font-extrabold text-indigo-300 uppercase text-[10px] tracking-wider mb-0.5">
                          Kesimpulan Pola Kebiasaan
                        </div>
                        {detailModal.data.profile.habitSummaryText}
                      </div>
                    </div>

                    {/* 4 KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Frekuensi Sukses</div>
                        <div className="text-lg font-extrabold text-white mt-1">
                          {detailModal.data.profile.totalTrx}x Trx
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {detailModal.data.profile.activeDays} hari aktif • Maks {detailModal.data.profile.maxTrxInOneDay}x/hari
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Total Belanja</div>
                        <div className="text-lg font-extrabold text-emerald-400 mt-1">
                          {formatRupiah(detailModal.data.profile.totalOmset)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Rata-rata: {formatRupiah(detailModal.data.profile.avgTicketSize)}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Outlet Favorit</div>
                        <div className="text-sm font-extrabold text-white mt-1 truncate">
                          {detailModal.data.profile.primaryOutlet}
                        </div>
                        <div className="text-[11px] text-indigo-300 mt-0.5">
                          Loyalitas {detailModal.data.profile.loyaltyPct}% ({detailModal.data.profile.outletCount} outlet)
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Waktu & Hari Favorit</div>
                        <div className="text-sm font-extrabold text-cyan-300 mt-1">
                          Jam {detailModal.data.profile.peakHour} ({detailModal.data.profile.favoriteDayOfWeek})
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {detailModal.data.profile.dominantTimeSlot}
                        </div>
                      </div>
                    </div>

                    {/* Hourly & Day-of-Week Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          Pola Jam Transaksi (00:00 - 23:00)
                        </h4>
                        <div className="flex items-end gap-1 h-32 pt-2">
                          {(detailModal.data.hourlyDistribution || []).map((h) => {
                            const maxTrx = Math.max(
                              1,
                              ...(detailModal.data.hourlyDistribution || []).map((x) => x.trx)
                            );
                            const pct = Math.round((h.trx / maxTrx) * 100);
                            return (
                              <div
                                key={h.hour}
                                className="flex-1 flex flex-col items-center justify-end h-full group"
                                title={`Jam ${h.label}: ${h.trx}x (${formatRupiah(h.omset)})`}
                              >
                                <div className="w-full bg-slate-900 rounded-t flex items-end justify-center h-24">
                                  <div
                                    className="w-full bg-indigo-500 group-hover:bg-cyan-400 rounded-t transition-all"
                                    style={{ height: `${Math.max(h.trx > 0 ? 12 : 0, pct)}%` }}
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

                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-emerald-400" />
                          Distribusi Hari Transaksi
                        </h4>
                        <div className="space-y-2">
                          {(detailModal.data.dayOfWeekDistribution || []).map((d) => {
                            const maxDow = Math.max(
                              1,
                              ...(detailModal.data.dayOfWeekDistribution || []).map((x) => x.trx)
                            );
                            const widthPct = Math.round((d.trx / maxDow) * 100);
                            return (
                              <div key={d.dow} className="flex items-center gap-2 text-xs tabular-nums">
                                <span className="w-16 text-slate-300 font-semibold">{d.label}</span>
                                <div className="flex-1 h-3 rounded-full bg-slate-900 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${d.trx > 0 ? Math.max(8, widthPct) : 0}%` }}
                                  />
                                </div>
                                <span className="w-12 text-right font-bold text-white">{d.trx}x</span>
                                <span className="w-24 text-right text-[11px] text-slate-400">
                                  {formatCompactRupiah(d.omset)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Outlet Loyalty & Favorite Products */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                          <Store className="w-4 h-4 text-indigo-400" />
                          Distribusi Kunjungan Outlet
                        </h4>
                        <div className="space-y-2.5 tabular-nums">
                          {(detailModal.data.outletBreakdown || []).map((o) => (
                            <div key={o.outletName} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-white">
                                  {o.outletName}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">({o.subCluster})</span>
                                </span>
                                <span className="font-bold text-indigo-300">
                                  {o.trx}x ({o.sharePct}%) • {formatCompactRupiah(o.omset)}
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                                <div
                                  className="h-full bg-indigo-500 rounded-full"
                                  style={{ width: `${Math.max(4, o.sharePct)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4 text-amber-400" />
                          Produk & Kategori yang Sering Dibeli
                        </h4>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(detailModal.data.categoryBreakdown || []).map((cat) => (
                            <span
                              key={cat.categoryId}
                              className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-800 text-slate-200"
                            >
                              {cat.shortName}: {cat.trx}x ({cat.sharePct}%)
                            </span>
                          ))}
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 tabular-nums">
                          {(detailModal.data.productBreakdown || []).map((p) => (
                            <div
                              key={p.produk}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/80 border border-slate-800"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-indigo-300">{p.produk}</span>
                                <span className="text-[11px] text-slate-400 truncate">({p.subCategory})</span>
                              </div>
                              <div className="shrink-0 ml-2">
                                <span className="font-bold text-white">{p.trx}x</span>
                                <span className="text-[11px] text-slate-400 ml-2">{formatRupiah(p.omset)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Transaction History Table */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Riwayat Transaksi ({detailModal.data.totalMatchedTransactions || 0} Transaksi)
                      </h4>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-xs tabular-nums">
                          <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                            <tr>
                              <th className="py-2 px-3">Waktu Entri</th>
                              <th className="py-2 px-3">Outlet / Reseller</th>
                              <th className="py-2 px-3">Produk</th>
                              <th className="py-2 px-3">Kategori</th>
                              <th className="py-2 px-3 text-right">Harga Jual</th>
                              <th className="py-2 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {(detailModal.data.transactions || []).map((tx, idx) => (
                              <tr key={`${tx.id || idx}`} className="hover:bg-slate-900/70">
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                                  {String(tx.tglEntri || '').replace('T', ' ').slice(0, 19)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-white">{tx.reseller}</td>
                                <td className="py-2 px-3 font-mono font-bold text-indigo-300">{tx.produk}</td>
                                <td className="py-2 px-3 text-slate-400">{tx.subCategory}</td>
                                <td className="py-2 px-3 text-right font-bold text-white whitespace-nowrap">
                                  {formatRupiah(tx.hrgJual)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      tx.status === 'Sukses'
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : 'bg-rose-500/15 text-rose-300'
                                    }`}
                                  >
                                    {tx.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

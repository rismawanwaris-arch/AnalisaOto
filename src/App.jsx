import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Settings,
  Table,
  AlertTriangle,
  Wand2,
  MessageSquareShare,
  Calendar,
  ShieldCheck,
  Server,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  Menu,
  X,
  ArrowRightLeft,
  Store,
  Layers,
  TrendingUp,
  AlertOctagon,
  Sparkles,
  Building2,
  Lock,
  LogOut,
  Users,
} from 'lucide-react';
import ExecutiveKpiCards from './components/ExecutiveKpiCards.jsx';
import ComparativeCharts from './components/ComparativeCharts.jsx';
import SideBySideCategoryTable from './components/SideBySideCategoryTable.jsx';
import OutletAnalyticsView from './components/OutletAnalyticsView.jsx';
import GrowthAndFailureSections from './components/GrowthAndFailureSections.jsx';
import UploadView from './components/UploadView.jsx';
import RulesSettingsView from './components/RulesSettingsView.jsx';
import TransactionExplorerView from './components/TransactionExplorerView.jsx';
import UncategorizedWizardModal from './components/UncategorizedWizardModal.jsx';
import WhatsAppSummaryModal from './components/WhatsAppSummaryModal.jsx';
import LoginView from './components/LoginView.jsx';
import ChangePasswordModal from './components/ChangePasswordModal.jsx';
import UserManagementView from './components/UserManagementView.jsx';
import {
  formatShortDateIndo,
  formatNumber,
  formatRupiah,
  formatCompactRupiah,
  formatPercent,
} from './utils/format.js';
import { apiFetch, registerUnauthorizedHandler } from './utils/api.js';

export default function App() {
  const [authState, setAuthState] = useState({
    checking: true,
    authenticated: false,
    username: null,
    displayName: null,
    role: 'viewer',
    usingDefaultPassword: false,
  });
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [activeMenu, setActiveMenu] = useState('dashboard'); // 'dashboard' | 'kategori_produk' | 'outlets' | 'tren_jam' | 'audit_gagal' | 'explorer' | 'upload' | 'rules'
  const [selectedProductCategoryId, setSelectedProductCategoryId] = useState('ALL');
  const [selectedOutletSubTab, setSelectedOutletSubTab] = useState('overview_plc_kbb');
  const [showFullCombinedDashboard, setShowFullCombinedDashboard] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Period Comparison State (PRD Section 5.1)
  const [preset, setPreset] = useState('yesterday_vs_daybefore'); // 'yesterday_vs_daybefore' | 'today_vs_yesterday' | 'this_week_vs_last_week' | 'custom'
  const [customD1, setCustomD1] = useState('2026-11-02');
  const [customD2, setCustomD2] = useState('2026-11-01');

  // Data States
  const [bootstrapData, setBootstrapData] = useState({
    datesSummary: [],
    categories: [],
    rules: [],
    uploadHistory: [],
    uncategorized: { hasUncategorized: false, uncategorizedProductCount: 0, totalUncategorizedTrx: 0, items: [] },
    demoToolsEnabled: false,
  });
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Modals & Toasts
  const [wizardOpen, setWizardOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [quickWaCopied, setQuickWaCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
      const data = await res.json();
      setAuthState({
        checking: false,
        authenticated: Boolean(data.authenticated),
        username: data.username || null,
        displayName: data.displayName || data.username || null,
        role: data.role || 'viewer',
        usingDefaultPassword: Boolean(data.usingDefaultPassword),
      });
    } catch {
      setAuthState({
        checking: false,
        authenticated: false,
        username: null,
        displayName: null,
        role: 'viewer',
        usingDefaultPassword: false,
      });
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setAuthState((prev) => ({ ...prev, authenticated: false }));
      setAnalytics(null);
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', skipAuthRedirect: true });
    } catch {
      // Ignore network errors on logout
    }
    setAuthState({
      checking: false,
      authenticated: false,
      username: null,
      usingDefaultPassword: false,
    });
    setAnalytics(null);
  };

  const fetchBootstrap = useCallback(async () => {
    if (!authState.authenticated) return null;
    try {
      const res = await apiFetch('/api/bootstrap');
      if (res.status === 401) return null;
      const data = await res.json();
      setBootstrapData(data);
      return data;
    } catch (err) {
      console.error('Failed fetching bootstrap:', err);
      return null;
    }
  }, [authState.authenticated]);

  const fetchAnalytics = useCallback(async (targetPreset = preset, targetD1 = customD1, targetD2 = customD2) => {
    if (!authState.authenticated) return;
    setLoadingAnalytics(true);
    try {
      const params = new URLSearchParams({
        preset: targetPreset,
        d1: targetD1,
        d2: targetD2,
      });
      const res = await apiFetch(`/api/analytics?${params.toString()}`);
      if (res.status === 401) return;
      const data = await res.json();
      setAnalytics(data);
      if (data.period?.d1Dates?.length === 1 && targetPreset !== 'custom') {
        setCustomD1(data.period.d1Dates[0]);
      }
      if (data.period?.d2Dates?.length === 1 && targetPreset !== 'custom') {
        setCustomD2(data.period.d2Dates[0]);
      }
    } catch (err) {
      console.error('Failed fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [authState.authenticated, preset, customD1, customD2]);

  useEffect(() => {
    if (authState.authenticated) {
      fetchBootstrap();
    }
  }, [authState.authenticated, fetchBootstrap]);

  useEffect(() => {
    if (authState.authenticated) {
      fetchAnalytics(preset, customD1, customD2);
    }
  }, [authState.authenticated, preset, customD1, customD2, fetchAnalytics]);

  const handleRefreshAll = async () => {
    await fetchBootstrap();
    await fetchAnalytics(preset, customD1, customD2);
  };

  // Handle batch mapping from Uncategorized Wizard (Instant Recalculation)
  const handleApplyWizardMappings = async ({ mappings, newCategories }) => {
    const res = await apiFetch('/api/rules/batch-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings, newCategories }),
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (res.ok) {
      showToast(
        `Berhasil menyimpan ${data.addedCount} aturan baru ke Kamus Kategori & menghitung ulang laporan secara instan!`,
        'success'
      );
      await handleRefreshAll();
    }
  };

  // Handle 1-click simulation of new uncategorized products
  const handleSimulateNewProducts = async (mode = 'prd_example') => {
    const res = await apiFetch('/api/simulate-new-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.status === 401) return;
    const data = await res.json();
    if (res.ok) {
      if (mode === 'upload_sample_file') {
        setPreset('custom');
        setCustomD1('2026-11-03');
        setCustomD2('2026-11-02');
      }
      await handleRefreshAll();
      setWizardOpen(true);
      showToast(
        `Simulasi Produk Baru Aktif: Ditemukan ${data.globalUncategorized?.uncategorizedProductCount || 0} jenis produk baru di Safe Staging!`,
        'warning'
      );
    }
  };

  const handleUploadSuccess = async (uploadData) => {
    await fetchBootstrap();
    if (uploadData.affectedDates?.length > 0) {
      const sorted = [...uploadData.affectedDates].sort((a, b) => b.localeCompare(a));
      const nextD1 = sorted[0];
      const nextD2 = sorted.length > 1 ? sorted[1] : customD2;
      const periodChanged = preset !== 'custom' || customD1 !== nextD1 || (sorted.length > 1 && customD2 !== nextD2);
      setPreset('custom');
      setCustomD1(nextD1);
      if (sorted.length > 1) {
        setCustomD2(nextD2);
      }
      if (!periodChanged) {
        await fetchAnalytics('custom', nextD1, nextD2);
      }
    } else {
      await fetchAnalytics();
    }
    if (uploadData.uploadUncategorized?.hasUncategorized) {
      setWizardOpen(true);
    }
  };

  const handleDeleteDate = async (dateStr) => {
    const res = await apiFetch(`/api/dates/${dateStr}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Data tanggal ${dateStr} telah dihapus dari database lokal.`);
      await handleRefreshAll();
    }
  };

  const handleSelectDateForComparison = (dateStr, slot) => {
    setPreset('custom');
    if (slot === 'd1') {
      setCustomD1(dateStr);
    } else {
      setCustomD2(dateStr);
    }
    setActiveMenu('dashboard');
    showToast(`Tanggal ${dateStr} dipilih sebagai ${slot.toUpperCase()} pada Dashboard Komparasi.`);
  };

  const handleQuickCopyWA = async () => {
    if (!analytics?.whatsappText) return;
    try {
      await navigator.clipboard.writeText(analytics.whatsappText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = analytics.whatsappText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setQuickWaCopied(true);
    setTimeout(() => setQuickWaCopied(false), 2500);
    showToast('Teks Laporan Harian WhatsApp berhasil disalin ke Clipboard!');
  };

  const globalUncat = analytics?.uncategorized?.global || bootstrapData.uncategorized;
  const hasUncategorized = globalUncat?.hasUncategorized;

  const navItems = [
    {
      id: 'dashboard',
      section: 'MENU ANALISA HARIAN',
      label: '1. Ringkasan Eksekutif',
      shortLabel: 'Ringkasan',
      icon: LayoutDashboard,
      badge: 'Utama',
    },
    {
      id: 'kategori_produk',
      section: 'MENU ANALISA HARIAN',
      label: '2. Analisa Kategori Produk',
      shortLabel: '5 Kategori Produk',
      icon: Layers,
      badge: '5 Pilar',
    },
    {
      id: 'outlets',
      section: 'MENU ANALISA HARIAN',
      label: '3. Analisa Cabang PLC & KBB',
      shortLabel: 'Cabang PLC & KBB',
      icon: Store,
      badge: `${analytics?.outletAnalytics?.kpi?.officialTrx?.totalOutlets || 45} Cabang`,
    },
    {
      id: 'tren_jam',
      section: 'MENU ANALISA HARIAN',
      label: '4. Jam Sibuk & Tren Produk',
      shortLabel: 'Jam & Tren',
      icon: TrendingUp,
      badge: analytics?.peakHours?.byTrxD1?.label || '24 Jam',
    },
    {
      id: 'audit_gagal',
      section: 'MENU ANALISA HARIAN',
      label: '5. Audit Transaksi Gagal',
      shortLabel: 'Audit Gagal',
      icon: AlertOctagon,
      badge: `${analytics?.failureAudit?.summary?.totalD1 || 0} Gagal`,
    },
    {
      id: 'explorer',
      section: 'DATA & PENGATURAN SISTEM',
      label: '6. Cari Transaksi Mentah',
      shortLabel: 'Cari Transaksi',
      icon: Table,
      badge: null,
    },
    ...(authState.role === 'admin' || authState.role === 'analyst'
      ? [
          {
            id: 'upload',
            section: 'DATA & PENGATURAN SISTEM',
            label: '7. Upload Excel & Kalender',
            shortLabel: 'Upload Data',
            icon: UploadCloud,
            badge: `${bootstrapData.datesSummary?.length || 0} Hari`,
          },
          {
            id: 'rules',
            section: 'DATA & PENGATURAN SISTEM',
            label: '8. Kamus Kategori & Produk',
            shortLabel: 'Kamus Aturan',
            icon: Settings,
            badge: hasUncategorized ? `${globalUncat.uncategorizedProductCount} Baru!` : `${bootstrapData.rules?.length || 0}`,
            badgeWarning: hasUncategorized,
          },
        ]
      : []),
    ...(authState.role === 'admin'
      ? [
          {
            id: 'users',
            section: 'DATA & PENGATURAN SISTEM',
            label: '9. Management User',
            shortLabel: 'Kelola User',
            icon: Users,
            badge: 'Admin',
          },
        ]
      : []),
  ];

  if (authState.checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
          <span className="text-xs font-semibold">Memeriksa sesi keamanan...</span>
        </div>
      </div>
    );
  }

  if (!authState.authenticated) {
    return (
      <LoginView
        usingDefaultPassword={authState.usingDefaultPassword}
        onLoginSuccess={(loginData) => {
          setAuthState((prev) => ({
            ...prev,
            authenticated: true,
            username: loginData?.username || loginData,
            displayName: loginData?.displayName || loginData?.username || loginData,
            role: loginData?.role || 'viewer',
          }));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl bg-slate-900 border border-indigo-500/50 shadow-2xl flex items-center gap-3 animate-slide-in-right">
          {toastMessage.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold text-white">{toastMessage.msg}</span>
        </div>
      )}

      {/* SIDEBAR NAVIGATION (Animated collapse/expand) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-slate-900/95 border-r border-slate-800/90 transition-all duration-300 ease-out sticky top-0 h-screen z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-indigo-500/30 shrink-0">
              AO
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold tracking-tight text-white truncate">
                    AnalisaOto
                  </h1>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ZimaOS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Private Server Pulsa & PPOB
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={sidebarCollapsed ? 'Perlebar Menu' : 'Perkecil Menu'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            const showSectionHeader =
              !sidebarCollapsed &&
              (idx === 0 || navItems[idx - 1].section !== item.section);

            return (
              <React.Fragment key={item.id}>
                {showSectionHeader && (
                  <div
                    className={`px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ${
                      idx > 0 ? 'pt-3 mt-2 border-t border-slate-800/80' : 'pt-1'
                    }`}
                  >
                    {item.section}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setActiveMenu(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-950/60'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate animate-fade-in">{item.label}</span>
                    )}
                  </div>

                  {!sidebarCollapsed && item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        item.badgeWarning
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}

          {/* Quick Action: Open Uncategorized Wizard */}
          {!sidebarCollapsed && (
            <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-2 animate-fade-in">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Pintasan Mesin Kategori
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  hasUncategorized
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  Wizard Pemetaan
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] font-mono">
                  {globalUncat?.uncategorizedProductCount || 0}
                </span>
              </button>

              {bootstrapData.demoToolsEnabled && (
                <button
                  type="button"
                  onClick={() => handleSimulateNewProducts('prd_example')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-[11px] font-medium bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                  title="Klik untuk menguji munculnya produk baru belum terkategori sesuai PRD Bagian 3.2"
                >
                  <span>⚡ Simulasi Produk Baru</span>
                  <span className="text-[10px] text-amber-400 font-bold">Uji PRD</span>
                </button>
              )}
            </div>
          )}
        </nav>

        {/* ZimaOS Local Privacy & Security Footer */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setChangePasswordOpen(true)}
                className="p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-emerald-400"
                title="Keamanan Akun & Ubah Password"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                title="Keluar / Kunci Dashboard"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Sesi Terproteksi</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300">
                    {authState.username || 'admin'} ({authState.role || 'admin'})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  100% Lokal di <code className="text-slate-300">/app/data</code>. Akses API terkunci sesi HttpOnly.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setChangePasswordOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  Password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-bold border border-rose-500/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Kunci / Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* MOBILE HEADER & DRAWER */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
            AO
          </div>
          <span className="font-bold text-white text-sm">AnalisaOto ZimaOS</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-200"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-3 space-y-1 animate-fade-in">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold ${
                  activeMenu === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP STICKY CONTROL BAR: Period Comparison Selector & WA Summary Button */}
        <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/90 px-4 sm:px-6 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Period Presets & Custom Date Selector (PRD Section 5.1) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                {[
                  { id: 'yesterday_vs_daybefore', label: 'Kemarin vs Kemarin Lusa' },
                  { id: 'today_vs_yesterday', label: 'Hari Ini vs Kemarin' },
                  { id: 'this_week_vs_last_week', label: 'Minggu Ini vs Minggu Lalu' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPreset(p.id);
                      if (activeMenu !== 'dashboard') setActiveMenu('dashboard');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      preset === p.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Pickers from Available Calendar */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-slate-400 font-medium">D1:</span>
                <select
                  value={customD1}
                  onChange={(e) => {
                    setPreset('custom');
                    setCustomD1(e.target.value);
                  }}
                  className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
                >
                  {(bootstrapData.datesSummary || []).map((d) => (
                    <option key={d.date} value={d.date} className="bg-slate-900 text-white">
                      {formatShortDateIndo(d.date)} ({formatNumber(d.suksesTrx)} Trx)
                    </option>
                  ))}
                </select>

                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 mx-1" />

                <span className="text-slate-400 font-medium">D2:</span>
                <select
                  value={customD2}
                  onChange={(e) => {
                    setPreset('custom');
                    setCustomD2(e.target.value);
                  }}
                  className="bg-transparent font-bold text-slate-300 focus:outline-none cursor-pointer"
                >
                  {(bootstrapData.datesSummary || []).map((d) => (
                    <option key={d.date} value={d.date} className="bg-slate-900 text-white">
                      {formatShortDateIndo(d.date)} ({formatNumber(d.suksesTrx)} Trx)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Action Buttons: One-Click WA Report & Preview */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickCopyWA}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  quickWaCopied
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                }`}
                title="Salin langsung teks laporan WhatsApp ke Clipboard (1-Klik)"
              >
                {quickWaCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Cepat WA
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all"
              >
                <MessageSquareShare className="w-3.5 h-3.5" />
                Preview Laporan WA
              </button>
            </div>
          </div>
        </header>

        {/* UNCATEGORIZED INTERCEPTOR WARNING BANNER (PRD Section 3.2) */}
        {hasUncategorized && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 border border-amber-500/50 shadow-lg flex flex-wrap items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shrink-0 animate-pulse-subtle">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Peringatan Kalkulasi Belum Final (Safe Staging)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950">
                    [Belum Dikategorikan]
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 mt-1">
                  <strong>Perhatian:</strong> Ditemukan{' '}
                  <strong className="text-amber-300">
                    {globalUncat.uncategorizedProductCount} jenis produk baru
                  </strong>{' '}
                  (total{' '}
                  <strong className="text-amber-300">
                    {formatNumber(globalUncat.totalUncategorizedTrx)} transaksi
                  </strong>{' '}
                  senilai <strong className="text-amber-300">{formatRupiah(globalUncat.totalUncategorizedOmset)}</strong>)
                  yang belum memiliki kategori. Data telah disimpan sementara. Silakan petakan kategori produk tersebut
                  agar laporan akurat.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-950/50 transition-all shrink-0"
            >
              <Wand2 className="w-4 h-4" />
              Buka Wizard Pemetaan Kategori
            </button>
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* Bar Navigasi Cepat 5 Langkah Analisa Harian */}
          {['dashboard', 'kategori_produk', 'outlets', 'tren_jam', 'audit_gagal'].includes(
            activeMenu
          ) && (
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2.5 shadow-lg flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'dashboard',
                    label: '1. Ringkasan Eksekutif',
                    sub: 'Kesimpulan Cepat',
                    icon: LayoutDashboard,
                  },
                  {
                    id: 'kategori_produk',
                    label: '2. Kategori Produk',
                    sub: '5 Pilar Produk',
                    icon: Layers,
                  },
                  {
                    id: 'outlets',
                    label: '3. Cabang PLC & KBB',
                    sub: `${analytics?.outletAnalytics?.kpi?.officialTrx?.totalOutlets || 45} Cabang`,
                    icon: Store,
                  },
                  {
                    id: 'tren_jam',
                    label: '4. Jam Sibuk & Tren',
                    sub: '24 Jam & Top Produk',
                    icon: TrendingUp,
                  },
                  {
                    id: 'audit_gagal',
                    label: '5. Audit Transaksi Gagal',
                    sub: `${analytics?.failureAudit?.summary?.totalD1 || 0} Trx Gagal`,
                    icon: AlertOctagon,
                  },
                ].map((step) => {
                  const StepIcon = step.icon;
                  const active = activeMenu === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveMenu(step.id)}
                      className={`px-3.5 py-2 rounded-xl text-left transition-all flex items-center gap-2.5 ${
                        active
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                          : 'bg-slate-950/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
                      }`}
                    >
                      <StepIcon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-indigo-400'}`} />
                      <div>
                        <div className="text-xs font-extrabold leading-tight">{step.label}</div>
                        <div className={`text-[10px] ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {step.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshAll}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
                  title="Segarkan Kalkulasi"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              </div>
            </div>
          )}

          {/* MENU 1: RINGKASAN EKSEKUTIF (MUDAH DIANALISA DALAM 10 DETIK) */}
          {activeMenu === 'dashboard' && (
            <div key="dashboard-view" className="space-y-6 animate-fade-in-up">
              {/* Kotak Kesimpulan Pintar Hari Ini (Executive Insight Box) */}
              <div className="rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/40 p-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold text-white">
                        Ringkasan Kesimpulan Harian ({analytics?.period?.d1Label} vs {analytics?.period?.d2Label})
                      </h2>
                      <p className="text-xs text-slate-400">
                        Panduan cepat membaca performa hari ini — klik salah satu kartu kategori di bawah untuk membuka analisa rincinya.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFullCombinedDashboard(!showFullCombinedDashboard)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all"
                  >
                    {showFullCombinedDashboard
                      ? 'Sembunyikan Tabel Detail Gabungan'
                      : 'Tampilkan Semua Grafik & Tabel Lengkap Sekaligus'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-indigo-400">
                      1. KESIMPULAN OMSET SERVER
                    </div>
                    <div className="text-slate-200 mt-1 leading-relaxed">
                      Omset D1 tercatat <strong className="text-white">{formatRupiah(analytics?.kpi?.omset?.d1 || 0)}</strong> (
                      <strong className={analytics?.kpi?.omset?.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {formatPercent(analytics?.kpi?.omset?.pct || 0)}
                      </strong>{' '}
                      dibanding D2) dari <strong className="text-white">{formatNumber(analytics?.kpi?.transaksiSukses?.d1 || 0)} Trx Sukses</strong>.
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveMenu('kategori_produk')}
                    className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 hover:border-indigo-500/50 cursor-pointer"
                  >
                    <div className="text-[10px] font-bold uppercase text-cyan-400">
                      2. KATEGORI PRODUK TERBESAR →
                    </div>
                    <div className="text-slate-200 mt-1 leading-relaxed">
                      Pendorong terbesar adalah{' '}
                      <strong className="text-white">
                        {analytics?.categoryComparison?.[0]?.shortName || 'Transfer Bank'}
                      </strong>{' '}
                      senilai <strong className="text-emerald-400">{formatCompactRupiah(analytics?.categoryComparison?.[0]?.omsetD1 || 0)}</strong> (
                      {analytics?.categoryComparison?.[0]?.shareD1Pct || 0}% omset server).
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveMenu('outlets')}
                    className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 hover:border-emerald-500/50 cursor-pointer"
                  >
                    <div className="text-[10px] font-bold uppercase text-emerald-400">
                      3. CABANG KATEGORI PLC VS KBB →
                    </div>
                    <div className="text-slate-200 mt-1 leading-relaxed">
                      <strong>41 Cabang PLC</strong> menyumbang{' '}
                      <strong className="text-white">
                        {formatCompactRupiah(analytics?.outletAnalytics?.kpi?.plcSummary?.omsetD1 || 0)}
                      </strong>{' '}
                      ({formatNumber(analytics?.outletAnalytics?.kpi?.plcSummary?.trxD1 || 0)} Trx) &{' '}
                      <strong>4 Cabang KBB</strong> menyumbang{' '}
                      <strong className="text-white">
                        {formatCompactRupiah(analytics?.outletAnalytics?.kpi?.kbbSummary?.omsetD1 || 0)}
                      </strong>{' '}
                      ({formatNumber(analytics?.outletAnalytics?.kpi?.kbbSummary?.trxD1 || 0)} Trx).
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveMenu('audit_gagal')}
                    className="p-3.5 rounded-xl bg-slate-950/85 border border-slate-800 hover:border-amber-500/50 cursor-pointer"
                  >
                    <div className="text-[10px] font-bold uppercase text-amber-400">
                      4. JAM SIBUK & AUDIT GAGAL →
                    </div>
                    <div className="text-slate-200 mt-1 leading-relaxed">
                      Jam tersibuk pukul <strong className="text-white">{analytics?.peakHours?.byTrxD1?.label || '-'}</strong> ({analytics?.peakHours?.byTrxD1?.trxD1 || 0} Trx). Total transaksi tidak sukses:{' '}
                      <strong className="text-rose-400">{analytics?.failureAudit?.summary?.totalD1 || 0} Trx</strong>.
                    </div>
                  </div>
                </div>
              </div>

              {/* A. 4 Kartu KPI Utama Server */}
              <ExecutiveKpiCards kpi={analytics?.kpi} period={analytics?.period} />

              {/* B. PINTASAN CEPAT 1: PILIH KATEGORI PRODUK (5 PILAR) */}
              <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Kategori Analisa 1: Performa 5 Pilar Kategori Produk
                      </h3>
                      <p className="text-xs text-slate-400">
                        Klik salah satu kartu kategori produk di bawah untuk langsung melihat rincian Bank / E-Wallet / Operator & Kode Produknya.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductCategoryId('ALL');
                      setActiveMenu('kategori_produk');
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow transition-all"
                  >
                    Buka Menu Kategori Produk Lengkap →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {(analytics?.categoryComparison || []).map((cat) => (
                    <div
                      key={cat.categoryId}
                      onClick={() => {
                        setSelectedProductCategoryId(cat.categoryId);
                        setActiveMenu('kategori_produk');
                      }}
                      className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition-all flex flex-col justify-between tabular-nums group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800">
                            {cat.shareD1Pct}% Server
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-white mt-2 group-hover:text-indigo-300 transition-colors">
                          {cat.shortName}
                        </h4>
                        <div className="text-lg font-extrabold text-white mt-2">
                          {formatRupiah(cat.omsetD1)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          D2: {formatCompactRupiah(cat.omsetD2)}
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">
                          {formatNumber(cat.trxD1)} Trx
                        </span>
                        <span
                          className={`font-bold ${
                            cat.selisihRp >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatPercent(cat.selisihPct)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* C. PINTASAN CEPAT 2: KATEGORI CABANG PLC & KBB */}
              <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Kategori Analisa 2: Performa Cabang Kategori PLC (41 Cabang) & Kategori KBB (4 Cabang)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Klik pada kartu <strong>Kategori PLC</strong> atau <strong>Kategori KBB</strong> untuk menganalisa cabang dan rincian produk di dalamnya.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutletSubTab('gainers_losers');
                        setActiveMenu('outlets');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-extrabold transition-all"
                    >
                      Lihat Evaluasi Cabang Naik vs Turun →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutletSubTab('overview_plc_kbb');
                        setActiveMenu('outlets');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow transition-all"
                    >
                      Buka Menu Cabang PLC & KBB →
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {(analytics?.outletAnalytics?.outletGroupComparison || []).map((grp) => {
                    const isKbb = grp.groupId === 'out_kbb';
                    return (
                      <div
                        key={grp.groupId}
                        onClick={() => {
                          setSelectedOutletSubTab(isKbb ? 'kbb_only' : 'plc_only');
                          setActiveMenu('outlets');
                        }}
                        className={`p-5 rounded-2xl bg-slate-950/90 border cursor-pointer transition-all tabular-nums ${
                          isKbb
                            ? 'border-emerald-500/30 hover:border-emerald-400'
                            : 'border-indigo-500/30 hover:border-indigo-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Building2
                              className={`w-5 h-5 ${
                                isKbb ? 'text-emerald-400' : 'text-indigo-400'
                              }`}
                            />
                            <h4 className="text-base font-extrabold text-white">
                              {grp.name} ({grp.outletCount} Cabang)
                            </h4>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              grp.selisihRp >= 0
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {formatPercent(grp.selisihPct)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 mt-1">{grp.description}</p>

                        <div className="grid grid-cols-3 gap-3 mt-4">
                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Total Omset D1
                            </div>
                            <div className="text-sm sm:text-base font-extrabold text-white mt-1">
                              {formatRupiah(grp.omsetD1)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              D2: {formatCompactRupiah(grp.omsetD2)}
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Transaksi Sukses
                            </div>
                            <div className="text-sm sm:text-base font-extrabold text-white mt-1">
                              {formatNumber(grp.trxD1)} Trx
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {grp.activeOutletsD1} Cabang Aktif
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              Rata-Rata / Cabang
                            </div>
                            <div className="text-sm sm:text-base font-extrabold text-cyan-300 mt-1">
                              {formatCompactRupiah(grp.avgOmsetPerOutletD1)}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Porsi: {grp.shareD1Pct}% Server
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            Cabang #1:{' '}
                            <strong className="text-white">
                              {grp.outlets?.[0]?.outletName || '-'}
                            </strong>{' '}
                            ({formatCompactRupiah(grp.outlets?.[0]?.omsetD1 || 0)})
                          </span>
                          <span
                            className={`font-extrabold ${
                              isKbb ? 'text-emerald-400' : 'text-indigo-400'
                            }`}
                          >
                            Buka Rincian {grp.outletCount} Cabang →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Jika pengguna menekan "Tampilkan Semua Grafik & Tabel Lengkap Sekaligus" */}
              {showFullCombinedDashboard && (
                <div className="space-y-6 pt-2 animate-fade-in">
                  <ComparativeCharts
                    categoryComparison={analytics?.categoryComparison || []}
                    hourlyComparison={analytics?.hourlyComparison || []}
                    peakHours={analytics?.peakHours || {}}
                    period={analytics?.period || {}}
                    totalOmsetD1={analytics?.kpi?.omset?.d1 || 0}
                    totalTrxD1={analytics?.kpi?.transaksiSukses?.d1 || 0}
                    outletAnalytics={analytics?.outletAnalytics || {}}
                  />
                  <SideBySideCategoryTable
                    categoryComparison={analytics?.categoryComparison || []}
                    period={analytics?.period || {}}
                    kpi={analytics?.kpi || {}}
                  />
                  <OutletAnalyticsView
                    outletAnalytics={analytics?.outletAnalytics || {}}
                    period={analytics?.period || {}}
                    compactMode={true}
                    onNavigateToFullOutletView={() => setActiveMenu('outlets')}
                  />
                  <GrowthAndFailureSections
                    growth={analytics?.growth || {}}
                    failureAudit={analytics?.failureAudit || {}}
                    period={analytics?.period || {}}
                  />
                </div>
              )}
            </div>
          )}

          {/* MENU 2: ANALISA PER KATEGORI PRODUK (5 PILAR) */}
          {activeMenu === 'kategori_produk' && (
            <SideBySideCategoryTable
              key="kategori-produk-view"
              categoryComparison={analytics?.categoryComparison || []}
              period={analytics?.period || {}}
              kpi={analytics?.kpi || {}}
              initialCategoryId={selectedProductCategoryId}
            />
          )}

          {/* MENU 3: ANALISA CABANG PLC & KBB */}
          {activeMenu === 'outlets' && (
            <OutletAnalyticsView
              key="outlets-view"
              outletAnalytics={analytics?.outletAnalytics || {}}
              period={analytics?.period || {}}
              compactMode={false}
              initialSubTab={selectedOutletSubTab}
            />
          )}

          {/* MENU 4: JAM SIBUK 24 JAM & TREN PERGERAKAN PRODUK */}
          {activeMenu === 'tren_jam' && (
            <div key="tren-jam-view" className="space-y-6 animate-fade-in-up">
              <ComparativeCharts
                categoryComparison={analytics?.categoryComparison || []}
                hourlyComparison={analytics?.hourlyComparison || []}
                peakHours={analytics?.peakHours || {}}
                period={analytics?.period || {}}
                totalOmsetD1={analytics?.kpi?.omset?.d1 || 0}
                totalTrxD1={analytics?.kpi?.transaksiSukses?.d1 || 0}
                outletAnalytics={analytics?.outletAnalytics || {}}
              />
              <GrowthAndFailureSections
                growth={analytics?.growth || {}}
                failureAudit={analytics?.failureAudit || {}}
                period={analytics?.period || {}}
                sectionMode="growth_only"
              />
            </div>
          )}

          {/* MENU 5: AUDIT TRANSAKSI GAGAL & KENDALA OPERASIONAL */}
          {activeMenu === 'audit_gagal' && (
            <div key="audit-gagal-view" className="space-y-6 animate-fade-in-up">
              <GrowthAndFailureSections
                growth={analytics?.growth || {}}
                failureAudit={analytics?.failureAudit || {}}
                period={analytics?.period || {}}
                sectionMode="failure_only"
              />
            </div>
          )}

          {/* MENU 6, 7, 8: UPLOAD, KAMUS ATURAN, & CARI TRANSAKSI */}
          {activeMenu === 'upload' && (
            <UploadView
              key="upload-view"
              datesSummary={bootstrapData.datesSummary || []}
              uploadHistory={bootstrapData.uploadHistory || []}
              demoToolsEnabled={Boolean(bootstrapData.demoToolsEnabled)}
              onUploadSuccess={handleUploadSuccess}
              onSimulateNewProducts={handleSimulateNewProducts}
              onDeleteDate={handleDeleteDate}
              onSelectDateForComparison={handleSelectDateForComparison}
              onOpenWizard={() => setWizardOpen(true)}
            />
          )}

          {activeMenu === 'rules' && (
            <RulesSettingsView
              key="rules-view"
              categories={bootstrapData.categories || []}
              rules={bootstrapData.rules || []}
              onRefreshBootstrap={handleRefreshAll}
              onOpenWizard={() => setWizardOpen(true)}
              uncategorizedCount={globalUncat?.uncategorizedProductCount || 0}
            />
          )}

          {activeMenu === 'explorer' && (
            <TransactionExplorerView
              key="explorer-view"
              datesSummary={bootstrapData.datesSummary || []}
              categories={bootstrapData.categories || []}
              defaultDate={customD1}
            />
          )}

          {activeMenu === 'users' && authState.role === 'admin' && (
            <UserManagementView
              key="users-view"
              currentUsername={authState.username}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Interactive Mapping Guide / Uncategorized Wizard Modal */}
      <UncategorizedWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        uncategorizedReport={globalUncat}
        categories={bootstrapData.categories || []}
        onApplyMappings={handleApplyWizardMappings}
      />

      {/* WhatsApp Summary Modal */}
      <WhatsAppSummaryModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        whatsappText={analytics?.whatsappText || ''}
        period={analytics?.period || {}}
        categoryComparison={analytics?.categoryComparison || []}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={(msg) => {
          setAuthState((prev) => ({ ...prev, usingDefaultPassword: false }));
          showToast(msg);
        }}
      />
    </div>
  );
}

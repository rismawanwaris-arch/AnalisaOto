import React from 'react';
import {
  Wallet,
  CheckCircle2,
  Coins,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  formatRupiah,
  formatNumber,
  formatPercent,
  useAnimatedNumber,
} from '../utils/format.js';

export default function ExecutiveKpiCards({ kpi = {}, period = {} }) {
  const animOmset = useAnimatedNumber(kpi?.omset?.d1 || 0);
  const animTrx = useAnimatedNumber(kpi?.transaksiSukses?.d1 || 0);
  const animLaba = useAnimatedNumber(kpi?.labaBersih?.d1 || 0);
  const animKomisi = useAnimatedNumber(kpi?.komisiReseller?.d1 || 0);

  const cards = [
    {
      id: 'omset',
      title: 'Total Omset Penjualan',
      valueDisplay: formatRupiah(animOmset),
      d2Display: formatRupiah(kpi?.omset?.d2 || 0),
      deltaNominal: `${(kpi?.omset?.diff || 0) >= 0 ? '+' : ''}${formatRupiah(kpi?.omset?.diff || 0)}`,
      deltaPct: formatPercent(kpi?.omset?.pct || 0),
      trend: kpi?.omset?.trend || 'flat',
      subtitle: `Kemarin (${period?.d2Label}): ${formatRupiah(kpi?.omset?.d2 || 0)}`,
      icon: Wallet,
      accent: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30 text-indigo-400',
      badgeGlow: 'shadow-indigo-950/50',
      delayClass: 'stagger-1',
    },
    {
      id: 'trx',
      title: 'Total Transaksi Sukses',
      valueDisplay: `${formatNumber(animTrx)} Trx`,
      extraBadge: `Success Rate: ${kpi?.transaksiSukses?.successRateD1 || 0}%`,
      d2Display: `${formatNumber(kpi?.transaksiSukses?.d2 || 0)} Trx (${kpi?.transaksiSukses?.successRateD2 || 0}%)`,
      deltaNominal: `${(kpi?.transaksiSukses?.diff || 0) >= 0 ? '+' : ''}${formatNumber(kpi?.transaksiSukses?.diff || 0)} Trx`,
      deltaPct: formatPercent(kpi?.transaksiSukses?.pct || 0),
      trend: kpi?.transaksiSukses?.trend || 'flat',
      subtitle: `D2: ${formatNumber(kpi?.transaksiSukses?.d2 || 0)} Sukses dari ${formatNumber(kpi?.transaksiSukses?.totalD2 || 0)} Trx`,
      icon: CheckCircle2,
      accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
      badgeGlow: 'shadow-emerald-950/50',
      delayClass: 'stagger-2',
    },
    {
      id: 'laba',
      title: 'Total Laba Bersih Server',
      valueDisplay: formatRupiah(animLaba),
      d2Display: formatRupiah(kpi?.labaBersih?.d2 || 0),
      deltaNominal: `${(kpi?.labaBersih?.diff || 0) >= 0 ? '+' : ''}${formatRupiah(kpi?.labaBersih?.diff || 0)}`,
      deltaPct: formatPercent(kpi?.labaBersih?.pct || 0),
      trend: kpi?.labaBersih?.trend || 'flat',
      subtitle: `Laba D2 (${period?.d2Label}): ${formatRupiah(kpi?.labaBersih?.d2 || 0)}`,
      icon: Coins,
      accent: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
      badgeGlow: 'shadow-cyan-950/50',
      delayClass: 'stagger-3',
    },
    {
      id: 'komisi',
      title: 'Total Komisi Reseller',
      valueDisplay: formatRupiah(animKomisi),
      d2Display: formatRupiah(kpi?.komisiReseller?.d2 || 0),
      deltaNominal: `${(kpi?.komisiReseller?.diff || 0) >= 0 ? '+' : ''}${formatRupiah(kpi?.komisiReseller?.diff || 0)}`,
      deltaPct: formatPercent(kpi?.komisiReseller?.pct || 0),
      trend: kpi?.komisiReseller?.trend || 'flat',
      subtitle: `Komisi D2 (${period?.d2Label}): ${formatRupiah(kpi?.komisiReseller?.d2 || 0)}`,
      icon: Users,
      accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
      badgeGlow: 'shadow-amber-950/50',
      delayClass: 'stagger-4',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isUp = card.trend === 'up';
        const isDown = card.trend === 'down';

        return (
          <div
            key={card.id}
            className={`relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 p-5 shadow-xl transition-all duration-300 hover:-translate-y-0.5 animate-fade-in-up ${card.delayClass}`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.title}
                </p>
                <h3 className="text-2xl font-extrabold text-white mt-1.5 tabular-nums tracking-tight">
                  {card.valueDisplay}
                </h3>
              </div>
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${card.accent}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>

            {card.extraBadge && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tabular-nums">
                  {card.extraBadge}
                </span>
              </div>
            )}

            {/* Delta Indicator Strip */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs tabular-nums">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                  isUp
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : isDown
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isUp ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : isDown ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                {card.deltaPct}
              </span>

              <span
                className={`font-mono font-semibold text-[11px] truncate ${
                  isUp ? 'text-emerald-300' : isDown ? 'text-rose-300' : 'text-slate-400'
                }`}
              >
                {card.deltaNominal}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 mt-1.5 truncate tabular-nums">
              {card.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}

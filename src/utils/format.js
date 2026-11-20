import { useState, useEffect, useRef } from 'react';

export function formatRupiah(value, withPrefix = true) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return withPrefix ? 'Rp 0' : '0';
  }
  const num = Math.round(Number(value));
  const isNeg = num < 0;
  const formatted = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (!withPrefix) return `${isNeg ? '-' : ''}${formatted}`;
  return `${isNeg ? '-Rp ' : 'Rp '}${formatted}`;
}

export function formatCompactRupiah(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
  }
  return `${sign}Rp ${abs}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  const num = Math.round(Number(value));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatPercent(value, includeSign = true) {
  const num = Number(value) || 0;
  const sign = includeSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

export function formatFullDateIndo(dateStr) {
  if (!dateStr) return '-';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const idx = parseInt(m, 10) - 1;
  return `${d} ${months[idx] || m} ${y}`;
}

export function formatShortDateIndo(dateStr) {
  if (!dateStr) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const idx = parseInt(m, 10) - 1;
  return `${d} ${months[idx] || m} ${y}`;
}

/**
 * Smooth number count-up hook for KPI cards
 */
export function useAnimatedNumber(targetValue, duration = 450) {
  const [displayValue, setDisplayValue] = useState(targetValue || 0);
  const prevValueRef = useRef(targetValue || 0);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = Number(targetValue) || 0;
    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    let startTime = null;
    let rafId = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (endValue - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevValueRef.current = endValue;
        setDisplayValue(endValue);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      prevValueRef.current = endValue;
    };
  }, [targetValue, duration]);

  return displayValue;
}

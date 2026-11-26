import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

/**
 * Reusable clickable table header cell with directional sort indicator.
 */
export default function SortableTh({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = 'left',
  defaultDir = 'desc',
  className = '',
}) {
  const isActive = sortConfig?.key === sortKey;
  const dir = isActive ? sortConfig.dir : null;
  const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';

  const alignClass =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
      ? 'justify-center text-center'
      : 'justify-start text-left';

  return (
    <th
      aria-sort={ariaSort}
      onClick={() => onSort?.(sortKey, defaultDir)}
      title={`Urutkan berdasarkan ${label}`}
      className={`cursor-pointer select-none group hover:text-white transition-colors ${className}`}
    >
      <div className={`inline-flex items-center gap-1.5 w-full ${alignClass}`}>
        <span className={isActive ? 'text-indigo-300' : ''}>{label}</span>
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-slate-300 shrink-0" />
        )}
      </div>
    </th>
  );
}

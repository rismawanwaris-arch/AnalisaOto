import React, { useState, useEffect } from 'react';
import {
  Table,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { formatRupiah, formatNumber, formatFullDateIndo } from '../utils/format.js';
import { apiFetch } from '../utils/api.js';

export default function TransactionExplorerView({
  datesSummary = [],
  categories = [],
  defaultDate = '',
}) {
  const [selectedDate, setSelectedDate] = useState(
    defaultDate || datesSummary[0]?.date || ''
  );
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        categoryId: selectedCat,
        status: selectedStatus,
        search: searchQuery,
        page: String(page),
        limit: '50',
      });
      const res = await apiFetch(`/api/transactions?${params.toString()}`);
      if (res.status === 401) return;
      const json = await res.json();
      if (res.ok) {
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedDate, selectedCat, selectedStatus, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Eksplorasi & Audit Rincian Baris Transaksi
              </h2>
              <p className="text-xs text-slate-400">
                Telusuri seluruh baris transaksi berdasarkan tanggal, kategori, status, nomor tujuan, maupun nama reseller.
              </p>
            </div>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-indigo-300 tabular-nums">
            Ditemukan: {formatNumber(data.total || 0)} Baris Transaksi
          </span>
        </div>

        {/* Filters */}
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 text-xs"
        >
          <div>
            <label className="block text-slate-400 mb-1">Tanggal Transaksi</label>
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            >
              <option value="">Semua Tanggal Tersimpan</option>
              {datesSummary.map((d) => (
                <option key={d.date} value={d.date}>
                  {formatFullDateIndo(d.date)} ({formatNumber(d.totalTrx)} Trx)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Filter Kategori</label>
            <select
              value={selectedCat}
              onChange={(e) => {
                setSelectedCat(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="uncategorized">[Belum Dikategorikan]</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Status Transaksi</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="Sukses">Hanya Sukses</option>
              <option value="GAGAL_ALL">Semua Tidak Sukses (Gagal/Gangguan)</option>
              <option value="Stok Kosong">Stok Kosong</option>
              <option value="Tujuan Salah">Tujuan Salah</option>
              <option value="Produk Gangguan">Produk Gangguan</option>
              <option value="Timeout">Timeout</option>
              <option value="Gagal">Gagal</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-slate-400 mb-1">
              Cari Kode Produk / Tujuan / Reseller / Modul
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik kode produk, nomor tujuan, nama agen..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                Cari
              </button>
            </div>
          </div>
        </form>

        {/* Table */}
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase">
              <tr>
                <th className="py-3 px-4">Waktu Entri</th>
                <th className="py-3 px-3">Produk</th>
                <th className="py-3 px-3">Kategori / Sub</th>
                <th className="py-3 px-3">Tujuan</th>
                <th className="py-3 px-3">Nama Reseller</th>
                <th className="py-3 px-3">Modul Supplier</th>
                <th className="py-3 px-3 text-right">Hrg. Beli</th>
                <th className="py-3 px-3 text-right">Hrg. Jual</th>
                <th className="py-3 px-3 text-right">Komisi</th>
                <th className="py-3 px-3 text-right">Laba</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Memuat data transaksi...
                  </td>
                </tr>
              ) : (data.items || []).length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    Tidak ada transaksi yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                data.items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-950/60">
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {String(tx.tglEntri).replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                      {tx.produk}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">{tx.subCategory}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                        {tx.categoryName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{tx.tujuan}</td>
                    <td className="py-2.5 px-3 text-slate-200">{tx.reseller}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{tx.modul}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {formatRupiah(tx.hrgBeli)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {formatRupiah(tx.hrgJual)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-300">
                      {formatRupiah(tx.komisi)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                      {formatRupiah(tx.laba)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          tx.status === 'Sukses'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            Halaman <strong className="text-white">{data.page || 1}</strong> dari{' '}
            <strong className="text-white">{data.totalPages || 1}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= (data.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 disabled:opacity-40"
            >
              Berikutnya
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

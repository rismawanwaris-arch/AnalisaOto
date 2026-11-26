import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  Database,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Wand2,
  Download,
  Layers,
  HardDrive,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { formatRupiah, formatNumber, formatFullDateIndo } from '../utils/format.js';
import { apiFetch } from '../utils/api.js';
import { sortArray, toggleSortConfig } from '../utils/sort.js';
import SortableTh from './SortableTh.jsx';

export default function UploadView({
  datesSummary = [],
  uploadHistory = [],
  demoToolsEnabled = false,
  onUploadSuccess,
  onSimulateNewProducts,
  onDeleteDate,
  onSelectDateForComparison,
  onOpenWizard,
}) {
  const [uploadMode, setUploadMode] = useState('single'); // 'single' | 'batch'
  const [dateSort, setDateSort] = useState({ key: 'date', dir: 'desc' });
  const sortedDatesSummary = useMemo(
    () => sortArray(datesSummary, dateSort),
    [datesSummary, dateSort]
  );
  const [writeMode, setWriteMode] = useState('replace'); // 'replace' | 'append'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFilesSelected = (fileList) => {
    const arr = Array.from(fileList || []).filter((f) =>
      /\.(xlsx|csv)$/i.test(f.name)
    );
    if (arr.length === 0) {
      setErrorMsg('Format file tidak didukung. Harap pilih file Excel (.xlsx atau .csv).');
      return;
    }
    setErrorMsg('');
    if (uploadMode === 'single') {
      setSelectedFiles([arr[0]]);
    } else {
      setSelectedFiles((prev) => [...prev, ...arr]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setErrorMsg('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      for (const f of selectedFiles) {
        formData.append('files', f);
      }
      formData.append('uploadMode', uploadMode);
      formData.append('writeMode', writeMode);

      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.status === 401) return;
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses file Excel.');
      }

      setUploadResult(data);
      setSelectedFiles([]);
      if (onUploadSuccess) {
        await onUploadSuccess(data);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Mode Selector Cards: Opsi 1 (Single Day) vs Opsi 2 (Multi-Day / Batch) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => {
            setUploadMode('single');
            if (selectedFiles.length > 1) setSelectedFiles([selectedFiles[0]]);
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            uploadMode === 'single'
              ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Opsi 1 • Rutinitas Harian
                </span>
                <h3 className="text-base font-bold text-white">Upload Harian (Single Day)</h3>
              </div>
            </div>
            <input
              type="radio"
              checked={uploadMode === 'single'}
              onChange={() => setUploadMode('single')}
              className="w-4 h-4 text-indigo-600 mt-1"
            />
          </div>
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            Unggah 1 file Excel rekap harian (misal pagi hari mengunggah rekap kemarin). Sistem otomatis membaca kolom{' '}
            <code className="text-indigo-300">Tgl. Entri</code> dan menempatkannya di kalender database lokal.
          </p>
        </div>

        <div
          onClick={() => setUploadMode('batch')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            uploadMode === 'batch'
              ? 'bg-cyan-600/15 border-cyan-500 shadow-lg shadow-cyan-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                  Opsi 2 • Multi-Hari / Batch
                </span>
                <h3 className="text-base font-bold text-white">
                  Upload Multi-Hari / Multi-File (Batch)
                </h3>
              </div>
            </div>
            <input
              type="radio"
              checked={uploadMode === 'batch'}
              onChange={() => setUploadMode('batch')}
              className="w-4 h-4 text-cyan-600 mt-1"
            />
          </div>
          <p className="text-xs text-slate-300 mt-3 leading-relaxed">
            Pilih beberapa file Excel sekaligus atau 1 file Excel besar berisi rentang seminggu/sebulan. Mesin parser
            otomatis memisahkan dan mengelompokkan data per tanggal (<code className="text-cyan-300">YYYY-MM-DD</code>).
          </p>
        </div>
      </div>

      {/* Main Upload Dropzone + Optional Demo Test Suite */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dropzone (8 Cols when demo enabled, 12 Cols in production) */}
        <div
          className={`${
            demoToolsEnabled ? 'lg:col-span-8' : 'lg:col-span-12'
          } bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Unggah File Rekap Transaksi Excel (.xlsx / .csv)
              </h3>
              <p className="text-xs text-slate-400">
                Mendukung format standar laporan server pulsa & PPOB (Tgl. Entri, Produk, Tujuan, Nama Reseller, Modul, Status, Hrg. Beli, Hrg. Jual, Komisi, Laba)
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setWriteMode('replace')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  writeMode === 'replace'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Timpa Tanggal Sama
              </button>
              <button
                type="button"
                onClick={() => setWriteMode('append')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  writeMode === 'append'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Gabungkan (Append)
              </button>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 hover:bg-slate-950'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              multiple={uploadMode === 'batch'}
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-3">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-white">
              Klik untuk memilih file Excel atau tarik & lepas (Drag & Drop) ke sini
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {uploadMode === 'single'
                ? 'Mode Upload Harian: Pilih 1 file Excel'
                : 'Mode Upload Batch: Dapat memilih banyak file sekaligus atau 1 file gabungan multi-hari'}
            </p>
          </div>

          {/* Selected Files Queue */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                File Siap Diproses ({selectedFiles.length} file):
              </div>
              {selectedFiles.map((file, i) => (
                <div
                  key={`${file.name}_${i}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">{file.name}</span>
                    <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="text-rose-400 hover:text-rose-300"
                  >
                    Hapus
                  </button>
                </div>
              ))}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleUploadSubmit}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-sm font-bold shadow-lg shadow-indigo-950/50 transition-all"
                >
                  <UploadCloud className="w-4 h-4" />
                  {isUploading ? 'Memproses & Memilah Tanggal...' : 'Proses & Simpan ke Database Lokal'}
                </button>
              </div>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="mt-4 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload Success Result */}
          {uploadResult && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>
                    Berhasil Memproses {formatNumber(uploadResult.totalValidRows)} Baris Transaksi!
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  Tanggal: {uploadResult.affectedDates?.join(', ')}
                </span>
              </div>

              {uploadResult.uploadUncategorized?.hasUncategorized && (
                <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 mt-2">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Ditemukan{' '}
                      <strong>
                        {uploadResult.uploadUncategorized.uncategorizedProductCount} produk baru
                      </strong>{' '}
                      ({uploadResult.uploadUncategorized.totalUncategorizedTrx} transaksi) yang belum memiliki kategori.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenWizard}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    Buka Wizard Pemetaan Sekarang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 4 Cols: Panel Simulasi & Uji Validitas PRD Section 7 (Dev/Demo Only) */}
        {demoToolsEnabled && (
          <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Simulasi & Verifikasi PRD (Mode Uji)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Uji cepat Uncategorized Interceptor & Wizard
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
                  <div className="text-xs font-bold text-amber-300">
                    1. Simulasi Produk Baru (Contoh PRD 3.2)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Melepas sementara beberapa aturan contoh (<code className="text-amber-300">MAXD</code>,{' '}
                    <code className="text-amber-300">HDTF</code>,{' '}
                    <code className="text-amber-300">VIY</code>) untuk menguji munculnya Banner Peringatan & Wizard Pemetaan Kategori.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSimulateNewProducts('prd_example')}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Picu Simulasi Produk Baru
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2">
                  <div className="text-xs font-bold text-indigo-300">
                    2. Muat Dataset Uji Produk Baru
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Memuat dataset uji lokal yang berisi beberapa contoh kode produk baru seperti <code className="text-indigo-300">MLBB86</code>, <code className="text-indigo-300">PDAMBDG</code>, <code className="text-indigo-300">LINKAJA50</code> (jika tersedia di server lokal).
                  </p>
                  <button
                    type="button"
                    onClick={() => onSimulateNewProducts('upload_sample_file')}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Muat Dataset Uji ke Database
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Calendar Database Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Kalender Database Persisten Lokal ZimaOS (/app/data)
              </h3>
              <p className="text-xs text-slate-400">
                Seluruh data tanggal yang pernah diunggah tersimpan permanen di server lokal tanpa perlu upload ulang.
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-emerald-400">
            Total Hari Tersimpan: {datesSummary.length} Hari
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase">
                <SortableTh
                  label="Tanggal Kalender"
                  sortKey="date"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  className="py-3 px-4"
                />
                <SortableTh
                  label="Total Baris Trx"
                  sortKey="totalTrx"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  align="right"
                  className="py-3 px-4"
                />
                <SortableTh
                  label="Trx Sukses"
                  sortKey="suksesTrx"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  align="right"
                  className="py-3 px-4"
                />
                <SortableTh
                  label="Trx Gagal"
                  sortKey="gagalTrx"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  align="right"
                  className="py-3 px-4"
                />
                <SortableTh
                  label="Total Omset (Rp)"
                  sortKey="omset"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  align="right"
                  className="py-3 px-4"
                />
                <SortableTh
                  label="Laba Bersih"
                  sortKey="laba"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  align="right"
                  className="py-3 px-4"
                />
                <SortableTh
                  label="Status Kategori"
                  sortKey="uncategorizedProductCount"
                  sortConfig={dateSort}
                  onSort={(k, d) => setDateSort((prev) => toggleSortConfig(prev, k, d))}
                  align="center"
                  className="py-3 px-4"
                />
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {sortedDatesSummary.map((d) => (
                <tr key={d.date} className="hover:bg-slate-950/60">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-sm text-white">
                      {formatFullDateIndo(d.date)}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{d.date}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-200">
                    {formatNumber(d.totalTrx)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">
                    {formatNumber(d.suksesTrx)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-rose-400">
                    {formatNumber(d.gagalTrx)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-white">
                    {formatRupiah(d.omset)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-indigo-300">
                    {formatRupiah(d.laba)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {d.uncategorizedProductCount > 0 ? (
                      <button
                        type="button"
                        onClick={onOpenWizard}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold hover:bg-amber-500/30"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {d.uncategorizedProductCount} Produk Belum Dipetakan
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        100% Terkategorisasi
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectDateForComparison(d.date, 'd1')}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold"
                        title="Jadikan Tanggal Utama (D1) di Dashboard"
                      >
                        Set D1
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectDateForComparison(d.date, 'd2')}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold"
                        title="Jadikan Tanggal Pembanding (D2) di Dashboard"
                      >
                        Set D2
                      </button>
                      {datesSummary.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteDate(d.date)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          title="Hapus tanggal ini dari database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

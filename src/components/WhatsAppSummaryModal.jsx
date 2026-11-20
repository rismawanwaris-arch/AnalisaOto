import React, { useState, useEffect } from 'react';
import { MessageSquareShare, Copy, Check, X, Sparkles } from 'lucide-react';

export default function WhatsAppSummaryModal({ isOpen, onClose, whatsappText, period }) {
  const [text, setText] = useState(whatsappText || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(whatsappText || '');
  }, [whatsappText]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600/20 via-teal-600/10 to-slate-900 border-b border-emerald-500/25 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <MessageSquareShare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Laporan Harian Siap Kirim WhatsApp (One-Click Summary)
              </h3>
              <p className="text-xs text-slate-400">
                Periode Komparasi: {period?.d1Label} vs {period?.d2Label}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Format otomatis menggunakan tanda bintang (*tebal*) dan garis bawah (_miring_) standar WhatsApp.
            </span>
            <button
              type="button"
              onClick={() => setText(whatsappText || '')}
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              Reset Teks
            </button>
          </div>

          <div className="relative rounded-xl bg-[#0b141a] border border-emerald-900/50 p-4 shadow-inner">
            <div className="text-[11px] font-semibold text-emerald-400 mb-2 flex items-center justify-between">
              <span>PREVIEW PESAN WHATSAPP OWNER / MANAJEMEN</span>
              <span className="text-slate-500 font-mono">UTF-8 / WA Markdown</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={17}
              className="w-full bg-[#1f2c34] text-slate-100 font-mono text-xs leading-relaxed p-4 rounded-xl border border-emerald-500/20 focus:border-emerald-500 focus:outline-none resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
              copied
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                Berhasil Disalin ke Clipboard!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Salin Teks Laporan WhatsApp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

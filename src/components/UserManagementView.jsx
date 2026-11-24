import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Eye,
  Edit3,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../utils/api.js';
import { formatFullDateIndo } from '../utils/format.js';

const ROLE_META = {
  admin: {
    label: 'Admin',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    desc: 'Akses penuh: Dashboard, Upload, Kamus Aturan, Hapus Data, & Management User.',
  },
  analyst: {
    label: 'Analis',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    desc: 'Analisa, Upload Excel, & kelola Kamus Kategori/Produk (tanpa hapus tanggal/user).',
  },
  viewer: {
    label: 'Viewer (Read-Only)',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    desc: 'Hanya lihat Dashboard, Analisa Cabang/Produk, & Audit Transaksi.',
  },
};

export default function UserManagementView({ currentUsername, onToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState('viewer');
  const [formPassword, setFormPassword] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/users');
      if (res.status === 401) return;
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal memuat daftar user.');
        return;
      }
      setUsers(data.users || []);
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormDisplayName('');
    setFormRole('viewer');
    setFormPassword('');
    setFormActive(true);
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormDisplayName(user.displayName || '');
    setFormRole(user.role || 'viewer');
    setFormPassword('');
    setFormActive(user.active !== false);
    setModalError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);

    try {
      if (editingUser) {
        const payload = {
          displayName: formDisplayName.trim(),
          role: formRole,
          active: formActive,
        };
        if (formPassword.trim().length > 0) {
          payload.password = formPassword;
        }
        const res = await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setModalError(data.error || 'Gagal memperbarui user.');
          return;
        }
        setUsers(data.users || []);
        setModalOpen(false);
        onToast?.(`Data user "${editingUser.username}" berhasil diperbarui.`);
      } else {
        const res = await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formUsername.trim().toLowerCase(),
            displayName: formDisplayName.trim(),
            role: formRole,
            password: formPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setModalError(data.error || 'Gagal menambah user baru.');
          return;
        }
        setUsers(data.users || []);
        setModalOpen(false);
        onToast?.(`User baru "${data.user?.username}" berhasil ditambahkan.`);
      }
    } catch {
      setModalError('Gagal menghubungi server.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast?.(data.error || 'Gagal mengubah status user.', 'warning');
        return;
      }
      setUsers(data.users || []);
      onToast?.(
        `Akun "${user.username}" ${!user.active ? 'diaktifkan kembali' : 'dinonaktifkan & sesinya dicabut'}.`
      );
    } catch {
      onToast?.('Gagal menghubungi server.', 'warning');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Hapus permanen akun "${user.username}"? Sesi login user tersebut akan langsung dihentikan.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        onToast?.(data.error || 'Gagal menghapus user.', 'warning');
        return;
      }
      setUsers(data.users || []);
      onToast?.(`Akun "${user.username}" berhasil dihapus.`);
    } catch {
      onToast?.('Gagal menghubungi server.', 'warning');
    }
  };

  const formatTimestamp = (iso) => {
    if (!iso) return 'Belum pernah login';
    try {
      const d = new Date(iso);
      const dateStr = iso.slice(0, 10);
      const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `${formatFullDateIndo(dateStr)} • ${timeStr}`;
    } catch {
      return iso;
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const analystCount = users.filter((u) => u.role === 'analyst').length;
  const viewerCount = users.filter((u) => u.role === 'viewer').length;
  const activeCount = users.filter((u) => u.active).length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">
              Pengaturan Management User & Hak Akses (RBAC)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola akun pengguna, role akses (Admin, Analis, Viewer), reset password, serta cabut sesi login secara instan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Segarkan Daftar User"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-indigo-950/50 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Tambah User Baru
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Total Akun Terdaftar</div>
          <div className="text-2xl font-extrabold text-white mt-1">{users.length} User</div>
          <div className="text-xs text-emerald-400 mt-1">{activeCount} Akun Aktif</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30">
          <div className="text-[11px] font-semibold uppercase text-indigo-300">Role Admin</div>
          <div className="text-2xl font-extrabold text-white mt-1">{adminCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Akses penuh & kelola user</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30">
          <div className="text-[11px] font-semibold uppercase text-cyan-300">Role Analis</div>
          <div className="text-2xl font-extrabold text-white mt-1">{analystCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Upload Excel & edit aturan</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30">
          <div className="text-[11px] font-semibold uppercase text-emerald-300">Role Viewer</div>
          <div className="text-2xl font-extrabold text-white mt-1">{viewerCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Lihat laporan saja (Read-Only)</div>
        </div>
      </div>

      {/* Role Legend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {Object.entries(ROLE_META).map(([roleKey, meta]) => (
          <div key={roleKey} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
            <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}>
                {meta.label}
              </span>
              <p className="text-slate-400 mt-1.5 leading-relaxed">{meta.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">Username & Nama Lengkap</th>
                <th className="py-3.5 px-4">Role Akses</th>
                <th className="py-3.5 px-4 text-center">Status Akun</th>
                <th className="py-3.5 px-4">Login Terakhir</th>
                <th className="py-3.5 px-5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.map((u) => {
                const meta = ROLE_META[u.role] || ROLE_META.viewer;
                const isSelf = u.username === currentUsername;
                return (
                  <tr key={u.id} className="hover:bg-slate-950/60 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-extrabold text-indigo-300 uppercase">
                          {(u.username || '?')[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            <span>{u.displayName || u.username}</span>
                            {isSelf && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Akun Anda
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">@{u.username}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}>
                        {u.role === 'admin' ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : u.role === 'viewer' ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <Shield className="w-3.5 h-3.5" />
                        )}
                        {meta.label}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                          u.active
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                        } ${isSelf ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={isSelf ? 'Tidak dapat menonaktifkan akun sendiri' : 'Klik untuk ubah status aktif/nonaktif'}
                      >
                        {u.active ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Nonaktif
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-4 text-slate-400 tabular-nums">
                      {formatTimestamp(u.lastLoginAt)}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                          Edit / Reset Pass
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen &&
        createPortal(
          <div
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl animate-scale-in"
            >
              <div className="px-5 py-4 bg-gradient-to-r from-indigo-600/20 to-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {editingUser ? (
                    <KeyRound className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <UserPlus className="w-5 h-5 text-indigo-400" />
                  )}
                  <h3 className="text-sm font-extrabold text-white">
                    {editingUser ? `Edit User: @${editingUser.username}` : 'Tambah User Baru'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {!editingUser && (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Username Login
                    </label>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      required
                      pattern="[a-zA-Z0-9._-]{3,32}"
                      placeholder="Contoh: staff_kasir atau budi.analis"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Nama Lengkap / Tampilan
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Role / Hak Akses
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    disabled={editingUser?.username === currentUsername}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                  >
                    <option value="viewer">Viewer (Hanya Lihat Dashboard & Laporan)</option>
                    <option value="analyst">Analis (Lihat, Upload Excel, & Edit Kategori)</option>
                    <option value="admin">Admin (Akses Penuh + Management User)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {editingUser ? 'Reset Password Baru (Opsional, min. 8 karakter)' : 'Password (Min. 8 karakter)'}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required={!editingUser}
                    minLength={formPassword.length > 0 || !editingUser ? 8 : undefined}
                    placeholder={editingUser ? 'Kosongkan jika tidak ingin mengganti password' : 'Minimal 8 karakter...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {editingUser && editingUser.username !== currentUsername && (
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span className="font-semibold text-slate-200">
                      Akun Aktif (nonaktifkan untuk mencabut akses login user ini)
                    </span>
                  </label>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold"
                  >
                    {saving ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat User'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const AUTH_CONFIG_FILE = path.join(DATA_DIR, '.auth_config.json');
const USERS_FILE = path.join(DATA_DIR, '.users.json');
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session_secret');
const SESSION_COOKIE_NAME = 'analisaoto_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VALID_ROLES = new Set(['admin', 'analyst', 'viewer']);

let usersCache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function writeSecretFileAtomic(filePath, content) {
  ensureDataDir();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmpPath, content, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup failure
      }
    }
    throw err;
  }
}

function getSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return process.env.SESSION_SECRET;
  }
  ensureDataDir();
  if (fs.existsSync(SESSION_SECRET_FILE)) {
    const existing = fs.readFileSync(SESSION_SECRET_FILE, 'utf-8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(48).toString('hex');
  writeSecretFileAtomic(SESSION_SECRET_FILE, generated);
  return generated;
}

function hashPassword(password, saltHex = null) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyScryptPassword(password, salt, expectedHashHex) {
  const derived = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

let dummyCredentialCache = null;
function getDummyCredential() {
  if (!dummyCredentialCache) {
    dummyCredentialCache = hashPassword(crypto.randomBytes(16).toString('hex'));
  }
  return dummyCredentialCache;
}

function constantTimeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf-8');
  const bufB = Buffer.from(String(b || ''), 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readLegacyAuthConfig() {
  if (!fs.existsSync(AUTH_CONFIG_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_CONFIG_FILE, 'utf-8'));
    if (parsed?.username && parsed?.salt && parsed?.hash) {
      return parsed;
    }
  } catch {
    // Ignore unreadable legacy file
  }
  return null;
}

function loadUsers() {
  if (usersCache) {
    return usersCache;
  }
  ensureDataDir();
  if (fs.existsSync(USERS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        usersCache = parsed;
        return usersCache;
      }
    } catch {
      // Fallback to initialization
    }
  }
  return null;
}

function saveUsers(users) {
  writeSecretFileAtomic(USERS_FILE, JSON.stringify(users, null, 2));
  usersCache = users;
}

function sanitizeUserForClient(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'viewer',
    active: user.active !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

/**
 * Ensures at least one Admin user exists in .users.json.
 * Migrates seamlessly from legacy .auth_config.json or ADMIN_USER/ADMIN_PASS env vars.
 */
export function ensureAuthInitialized() {
  ensureDataDir();
  const existing = loadUsers();
  const envUser = String(process.env.ADMIN_USER || 'admin').trim().toLowerCase() || 'admin';
  const envPass = String(process.env.ADMIN_PASS || '').trim();

  if (existing && existing.length > 0) {
    // If FORCE_ENV_AUTH=true and ADMIN_PASS is set, sync env admin credentials
    if (process.env.FORCE_ENV_AUTH === 'true' && envPass) {
      const { salt, hash } = hashPassword(envPass);
      const idx = existing.findIndex((u) => u.username === envUser);
      if (idx !== -1) {
        existing[idx] = {
          ...existing[idx],
          salt,
          hash,
          role: 'admin',
          active: true,
          updatedAt: new Date().toISOString(),
        };
      } else {
        existing.unshift({
          id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          username: envUser,
          displayName: 'Administrator',
          role: 'admin',
          active: true,
          salt,
          hash,
          sessionVersion: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: null,
        });
      }
      saveUsers(existing);
    }
    return existing;
  }

  // Migrate from legacy .auth_config.json if present
  const legacy = process.env.FORCE_ENV_AUTH !== 'true' ? readLegacyAuthConfig() : null;
  if (legacy) {
    const migrated = [
      {
        id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        username: String(legacy.username).trim().toLowerCase(),
        displayName: 'Administrator',
        role: 'admin',
        active: true,
        salt: legacy.salt,
        hash: legacy.hash,
        sessionVersion: 1,
        createdAt: legacy.createdAt || new Date().toISOString(),
        updatedAt: legacy.updatedAt || new Date().toISOString(),
        lastLoginAt: null,
      },
    ];
    saveUsers(migrated);
    return migrated;
  }

  // Create initial admin from ADMIN_PASS or generate random password
  let initialPass = envPass;
  let generated = false;
  if (!initialPass) {
    initialPass = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }

  const { salt, hash } = hashPassword(initialPass);
  const initialUsers = [
    {
      id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      username: envUser,
      displayName: 'Administrator',
      role: 'admin',
      active: true,
      salt,
      hash,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: null,
    },
  ];
  saveUsers(initialUsers);

  if (generated) {
    console.log('================================================================');
    console.log('🔐 KREDENSIAL ADMIN BARU DIBUAT OTOMATIS (CATAT SEKARANG):');
    console.log(`   Username : ${envUser}`);
    console.log(`   Password : ${initialPass}`);
    console.log('   (Segera ubah password melalui menu Keamanan Akun setelah login)');
    console.log('================================================================');
  }

  return initialUsers;
}

function getAllUsersInternal() {
  return loadUsers() || ensureAuthInitialized();
}

function findUserByUsername(username) {
  const clean = String(username || '').trim().toLowerCase();
  return getAllUsersInternal().find((u) => u.username === clean) || null;
}

function findUserById(id) {
  return getAllUsersInternal().find((u) => u.id === id) || null;
}

function signSessionToken(user) {
  const secret = getSessionSecret();
  const payloadObj = {
    uid: user.id,
    u: user.username,
    role: user.role || 'viewer',
    v: user.sessionVersion || 1,
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const secret = getSessionSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (!constantTimeStringEqual(sigB64, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!payload?.uid || !payload?.u || !payload?.exp || Date.now() > payload.exp) {
      return null;
    }
    const user = findUserById(payload.uid);
    if (!user || user.active === false) {
      return null;
    }
    if ((user.sessionVersion || 1) !== payload.v) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

export function getAuthenticatedUserObj(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  return verifySessionToken(token);
}

export function requireAuth(req, res, next) {
  const user = getAuthenticatedUserObj(req);
  if (!user) {
    return res.status(401).json({
      error: 'Akses ditolak. Silakan login terlebih dahulu untuk mengakses data AnalisaOto.',
      code: 'UNAUTHORIZED',
    });
  }
  req.user = user.username;
  req.userId = user.id;
  req.userRole = user.role || 'viewer';
  req.displayName = user.displayName || user.username;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Akses ditolak. Peran akun Anda tidak memiliki izin untuk tindakan ini.',
        code: 'FORBIDDEN',
      });
    }
    next();
  };
}

function setSessionCookie(res, req, token) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) {
    attrs.push('Secure');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
}

export function handleAuthStatus(req, res) {
  const user = getAuthenticatedUserObj(req);
  if (!user) {
    return res.json({
      authenticated: false,
      username: null,
      displayName: null,
      role: null,
      usingDefaultPassword: false,
    });
  }
  const envPass = String(process.env.ADMIN_PASS || '').trim();
  res.json({
    authenticated: true,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'viewer',
    usingDefaultPassword:
      process.env.FORCE_ENV_AUTH === 'true' &&
      Boolean(envPass) &&
      (envPass === 'GantiDenganPasswordKuatAnda#2026' || envPass.length < 12),
  });
}

export function handleLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }
  const user = findUserByUsername(username);
  // Always run scrypt (dummy hash for unknown users) so response time does not reveal valid usernames.
  const dummy = getDummyCredential();
  const passwordOk = verifyScryptPassword(
    String(password).slice(0, 256),
    user ? user.salt : dummy.salt,
    user ? user.hash : dummy.hash
  );
  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  if (user.active === false) {
    return res.status(403).json({ error: 'Akun ini sedang dinonaktifkan oleh Administrator.' });
  }

  const users = getAllUsersInternal();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], lastLoginAt: new Date().toISOString() };
    saveUsers(users);
  }

  const token = signSessionToken(users[idx] || user);
  setSessionCookie(res, req, token);
  res.json({
    success: true,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'viewer',
  });
}

export function handleLogout(req, res) {
  const user = getAuthenticatedUserObj(req);
  if (user) {
    const users = getAllUsersInternal();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      users[idx] = {
        ...users[idx],
        sessionVersion: (users[idx].sessionVersion || 1) + 1,
      };
      saveUsers(users);
    }
  }
  clearSessionCookie(res);
  res.json({ success: true });
}

export function handleChangePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Password baru minimal harus 8 karakter.' });
  }

  const users = getAllUsersInternal();
  const idx = users.findIndex((u) => u.id === req.userId);
  if (idx === -1 || !verifyScryptPassword(currentPassword, users[idx].salt, users[idx].hash)) {
    return res.status(401).json({ error: 'Password saat ini salah.' });
  }

  const { salt, hash } = hashPassword(String(newPassword));
  users[idx] = {
    ...users[idx],
    salt,
    hash,
    sessionVersion: (users[idx].sessionVersion || 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);

  const token = signSessionToken(users[idx]);
  setSessionCookie(res, req, token);

  res.json({
    success: true,
    message: 'Password berhasil diperbarui dan disimpan terenkripsi.',
  });
}

// ==================== USER MANAGEMENT HANDLERS (ADMIN ONLY) ====================

export function handleListUsers(req, res) {
  const users = getAllUsersInternal().map(sanitizeUserForClient);
  res.json({ users });
}

export function handleCreateUser(req, res) {
  const { username, displayName, password, role = 'viewer' } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
    return res.status(400).json({
      error: 'Username harus 3–32 karakter (hanya huruf kecil, angka, titik, underscore, atau strip).',
    });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password minimal harus 8 karakter.' });
  }
  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: 'Role tidak valid (pilih admin, analyst, atau viewer).' });
  }

  const users = getAllUsersInternal();
  if (users.some((u) => u.username === cleanUsername)) {
    return res.status(409).json({ error: `Username "${cleanUsername}" sudah terdaftar.` });
  }

  const { salt, hash } = hashPassword(String(password));
  const now = new Date().toISOString();
  const newUser = {
    id: `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    username: cleanUsername,
    displayName: String(displayName || cleanUsername).trim().slice(0, 60),
    role,
    active: true,
    salt,
    hash,
    sessionVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };

  users.push(newUser);
  saveUsers(users);

  res.status(201).json({
    success: true,
    user: sanitizeUserForClient(newUser),
    users: users.map(sanitizeUserForClient),
  });
}

export function handleUpdateUser(req, res) {
  const { id } = req.params;
  const { displayName, role, active, password } = req.body || {};

  const users = getAllUsersInternal();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }

  const target = users[idx];

  // Prevent admin from deactivating or demoting themselves
  if (target.id === req.userId) {
    if (active === false) {
      return res.status(400).json({ error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
    }
    if (role && role !== 'admin') {
      return res.status(400).json({ error: 'Anda tidak dapat menurunkan role admin Anda sendiri.' });
    }
  }

  // Prevent removing/disabling the last active admin
  const activeAdminsCount = users.filter((u) => u.role === 'admin' && u.active !== false).length;
  const isTargetActiveAdmin = target.role === 'admin' && target.active !== false;
  const willStopBeingActiveAdmin =
    (role && role !== 'admin') || active === false;
  if (isTargetActiveAdmin && willStopBeingActiveAdmin && activeAdminsCount <= 1) {
    return res.status(400).json({ error: 'Minimal harus ada 1 akun Admin yang aktif.' });
  }

  if (role && !VALID_ROLES.has(role)) {
    return res.status(400).json({ error: 'Role tidak valid.' });
  }

  let updatedSalt = target.salt;
  let updatedHash = target.hash;
  let bumpSession = false;

  if (password !== undefined && String(password).length > 0) {
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password baru minimal harus 8 karakter.' });
    }
    const hashed = hashPassword(String(password));
    updatedSalt = hashed.salt;
    updatedHash = hashed.hash;
    bumpSession = true;
  }

  if ((role && role !== target.role) || (active !== undefined && active !== target.active)) {
    bumpSession = true;
  }

  users[idx] = {
    ...target,
    displayName: displayName !== undefined ? String(displayName).trim().slice(0, 60) || target.username : target.displayName,
    role: role || target.role,
    active: active !== undefined ? Boolean(active) : target.active,
    salt: updatedSalt,
    hash: updatedHash,
    sessionVersion: bumpSession ? (target.sessionVersion || 1) + 1 : target.sessionVersion || 1,
    updatedAt: new Date().toISOString(),
  };

  saveUsers(users);

  res.json({
    success: true,
    user: sanitizeUserForClient(users[idx]),
    users: users.map(sanitizeUserForClient),
  });
}

export function handleDeleteUser(req, res) {
  const { id } = req.params;
  const users = getAllUsersInternal();
  const target = users.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'User tidak ditemukan.' });
  }
  if (target.id === req.userId) {
    return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang login.' });
  }
  if (target.role === 'admin' && target.active !== false) {
    const activeAdmins = users.filter((u) => u.role === 'admin' && u.active !== false).length;
    if (activeAdmins <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menghapus Admin terakhir.' });
    }
  }

  const remaining = users.filter((u) => u.id !== id);
  saveUsers(remaining);

  res.json({
    success: true,
    users: remaining.map(sanitizeUserForClient),
  });
}

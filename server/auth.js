import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const AUTH_CONFIG_FILE = path.join(DATA_DIR, '.auth_config.json');
const SESSION_SECRET_FILE = path.join(DATA_DIR, '.session_secret');
const SESSION_VERSION_FILE = path.join(DATA_DIR, '.session_version');
const SESSION_COOKIE_NAME = 'analisaoto_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cachedSessionVersion = null;

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

/**
 * Loads or generates a persistent cryptographic session secret.
 */
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

/**
 * Reads the monotonic session version used for server-side token revocation.
 */
function getSessionVersion() {
  if (typeof cachedSessionVersion === 'number' && cachedSessionVersion >= 1) {
    return cachedSessionVersion;
  }
  ensureDataDir();
  if (fs.existsSync(SESSION_VERSION_FILE)) {
    const parsed = parseInt(fs.readFileSync(SESSION_VERSION_FILE, 'utf-8').trim(), 10);
    if (Number.isInteger(parsed) && parsed >= 1) {
      cachedSessionVersion = parsed;
      return parsed;
    }
  }
  cachedSessionVersion = 1;
  writeSecretFileAtomic(SESSION_VERSION_FILE, '1');
  return 1;
}

/**
 * Increments the persisted session version, immediately revoking all previously issued tokens.
 */
function bumpSessionVersion() {
  const nextVersion = getSessionVersion() + 1;
  cachedSessionVersion = nextVersion;
  writeSecretFileAtomic(SESSION_VERSION_FILE, String(nextVersion));
  return nextVersion;
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

function constantTimeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf-8');
  const bufB = Buffer.from(String(b || ''), 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readValidHashedAuthConfig() {
  if (!fs.existsSync(AUTH_CONFIG_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(AUTH_CONFIG_FILE, 'utf-8'));
    if (parsed?.username && parsed?.salt && parsed?.hash) {
      return {
        mode: 'hashed',
        username: parsed.username,
        salt: parsed.salt,
        hash: parsed.hash,
      };
    }
  } catch {
    // Unreadable or invalid auth config file
  }
  return null;
}

/**
 * Ensures initial admin authentication is configured without any hardcoded fallback password.
 * If neither a hashed config file nor ADMIN_PASS env var exists, generates a random 16-char password once.
 */
export function ensureAuthInitialized() {
  ensureDataDir();
  if (process.env.FORCE_ENV_AUTH !== 'true') {
    const existing = readValidHashedAuthConfig();
    if (existing) return existing;
  }

  const envPass = String(process.env.ADMIN_PASS || '').trim();
  const envUser = String(process.env.ADMIN_USER || 'admin').trim() || 'admin';
  if (envPass) {
    return { mode: 'env', username: envUser, password: envPass };
  }

  // First run with no ADMIN_PASS and no .auth_config.json: generate a one-time random password
  const generatedPassword = crypto.randomBytes(12).toString('base64url');
  const { salt, hash } = hashPassword(generatedPassword);
  writeSecretFileAtomic(
    AUTH_CONFIG_FILE,
    JSON.stringify(
      {
        username: envUser,
        salt,
        hash,
        createdAt: new Date().toISOString(),
        initialGenerated: true,
      },
      null,
      2
    )
  );

  console.log('================================================================');
  console.log('🔐 KREDENSIAL ADMIN BARU DIBUAT OTOMATIS (CATAT SEKARANG):');
  console.log(`   Username : ${envUser}`);
  console.log(`   Password : ${generatedPassword}`);
  console.log('   (Segera ubah password melalui menu Keamanan Akun setelah login)');
  console.log('================================================================');

  return { mode: 'hashed', username: envUser, salt, hash };
}

/**
 * Returns active admin credentials configuration.
 * Priority:
 * 1. User-updated/generated hashed password in DATA_DIR/.auth_config.json (unless FORCE_ENV_AUTH=true)
 * 2. Environment variables ADMIN_USER / ADMIN_PASS
 * 3. First-run auto-generated password persisted hashed in DATA_DIR/.auth_config.json
 */
function getAuthConfig() {
  const envUser = String(process.env.ADMIN_USER || 'admin').trim() || 'admin';
  const envPass = String(process.env.ADMIN_PASS || '').trim();

  if (process.env.FORCE_ENV_AUTH !== 'true') {
    const existing = readValidHashedAuthConfig();
    if (existing) return existing;
  }

  if (envPass) {
    return { mode: 'env', username: envUser, password: envPass };
  }

  return ensureAuthInitialized();
}

function verifyCredentials(username, password) {
  const cfg = getAuthConfig();
  if (!constantTimeStringEqual(username, cfg.username)) {
    return false;
  }
  if (cfg.mode === 'hashed') {
    return verifyScryptPassword(password, cfg.salt, cfg.hash);
  }
  return constantTimeStringEqual(password, cfg.password);
}

function signSessionToken(username) {
  const secret = getSessionSecret();
  const payloadObj = {
    u: username,
    v: getSessionVersion(),
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
    if (!payload?.u || !payload?.exp || Date.now() > payload.exp) {
      return null;
    }
    if (payload.v !== getSessionVersion()) {
      return null;
    }
    return payload;
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

export function getAuthenticatedUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  const session = verifySessionToken(token);
  return session ? session.u : null;
}

export function requireAuth(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Akses ditolak. Silakan login terlebih dahulu untuk mengakses data AnalisaOto.',
      code: 'UNAUTHORIZED',
    });
  }
  req.user = user;
  next();
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
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.json({
      authenticated: false,
      username: null,
      usingDefaultPassword: false,
    });
  }
  const cfg = getAuthConfig();
  res.json({
    authenticated: true,
    username: user,
    usingDefaultPassword:
      cfg.mode === 'env' &&
      (cfg.password === 'GantiDenganPasswordKuatAnda#2026' || cfg.password.length < 12),
  });
}

export function handleLogin(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }
  if (!verifyCredentials(String(username).trim(), String(password))) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  const token = signSessionToken(String(username).trim());
  setSessionCookie(res, req, token);
  res.json({
    success: true,
    username: String(username).trim(),
  });
}

export function handleLogout(req, res) {
  const user = getAuthenticatedUser(req);
  if (user) {
    bumpSessionVersion();
  }
  clearSessionCookie(res);
  res.json({ success: true });
}

export function handleChangePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  const activeUser = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Password baru minimal harus 8 karakter.' });
  }
  if (!verifyCredentials(activeUser, String(currentPassword))) {
    return res.status(401).json({ error: 'Password saat ini salah.' });
  }

  ensureDataDir();
  const { salt, hash } = hashPassword(String(newPassword));
  writeSecretFileAtomic(
    AUTH_CONFIG_FILE,
    JSON.stringify(
      {
        username: activeUser,
        salt,
        hash,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // Invalidate all previously issued sessions, then issue a fresh cookie for this session
  bumpSessionVersion();
  const token = signSessionToken(activeUser);
  setSessionCookie(res, req, token);

  res.json({
    success: true,
    message: 'Password berhasil diperbarui dan disimpan terenkripsi.',
  });
}

import express from 'express';
import sqlite3 from 'sqlite3';
import { z } from 'zod';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
// Validation schemas
const PaginationParamsSchema = z.object({
    limit: z
        .string()
        .optional()
        .default('50')
        .pipe(z.coerce.number().int().min(1).max(100)),
    offset: z
        .string()
        .optional()
        .default('0')
        .pipe(z.coerce.number().int().min(0)),
});
const CustomerParamsSchema = PaginationParamsSchema.extend({
    search: z.string().optional(),
    status: z.enum(['Good', 'Warn', 'Bad']).optional(),
});
const HistoryParamsSchema = z.object({
    days: z
        .string()
        .optional()
        .default('7')
        .pipe(z.coerce.number().int())
        .refine((val) => [1, 7, 30, 90].includes(val), {
        message: 'days must be one of: 1, 7, 30, 90',
    }),
    limit: z
        .string()
        .optional()
        .default('200')
        .pipe(z.coerce.number().int().min(1).max(200)),
});
const WorstPerformersParamsSchema = z.object({
    limit: z
        .string()
        .optional()
        .default('10')
        .pipe(z.coerce.number().int().min(1).max(100)),
    status: z
        .string()
        .optional()
        .refine((val) => !val || ['Good', 'Warn', 'Bad'].includes(val), {
        message: 'status must be one of: Good, Warn, Bad',
    }),
});
// ============================================================================
// DATABASE SETUP
// ============================================================================
const dbPath = path.resolve(process.env.DB_PATH || './smartview.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err);
        process.exit(1);
    }
    console.log('Connected to SQLite database:', dbPath);
    db.run('CREATE INDEX IF NOT EXISTS idx_modem_history_recorded_at ON modem_history(recorded_at)');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, (createErr) => {
        if (createErr) {
            console.error('Failed to create users table:', createErr);
            return;
        }
        bootstrapAdmin();
    });
});
async function bootstrapAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword)
        return;
    const existing = await dbGet("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing)
        return;
    const hash = await bcrypt.hash(adminPassword, 12);
    const id = randomUUID();
    await dbRun("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'admin')", [id, adminEmail, hash]);
    console.log('Admin user created:', adminEmail);
}
// Promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, (err) => (err ? reject(err) : resolve())));
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
// ============================================================================
// AUTH CONSTANTS
// ============================================================================
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_USE_LONG_RANDOM_STRING';
const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
};
// ============================================================================
// RATE LIMITING
// ============================================================================
const loginAttempts = new Map();
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
        return true;
    }
    if (entry.count >= 5)
        return false;
    entry.count += 1;
    return true;
}
function clearRateLimit(ip) {
    loginAttempts.delete(ip);
}
// ============================================================================
// MIDDLEWARE
// ============================================================================
const cors = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
};
const errorHandler = (err, _req, res, _next) => {
    console.error('Error:', err);
    if (err instanceof z.ZodError) {
        return res.status(400).json({
            error: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: err.errors,
        });
    }
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
    });
};
function requireAuth(req, res, next) {
    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    }
}
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
        }
        next();
    });
}
// ============================================================================
// AUTH ROUTE HANDLERS
// ============================================================================
async function handleLogin(req, res, next) {
    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(ip)) {
            return res.status(429).json({ error: 'Too many login attempts', code: 'RATE_LIMITED' });
        }
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required', code: 'VALIDATION_ERROR' });
        }
        const user = await dbGet('SELECT id, email, role, is_active, created_at, password_hash FROM users WHERE email = ?', [email]);
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
        }
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
        }
        clearRateLimit(ip);
        const payload = { userId: user.id, email: user.email, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        res.cookie('auth_token', token, COOKIE_OPTS);
        res.json({ user: { id: user.id, email: user.email, role: user.role } });
    }
    catch (err) {
        next(err);
    }
}
async function handleLogout(_req, res) {
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'strict' });
    res.json({ message: 'Logged out' });
}
async function handleMe(req, res, next) {
    try {
        const { userId } = req.user;
        const user = await dbGet('SELECT id, email, role, is_active, created_at FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        }
        res.json({ data: user });
    }
    catch (err) {
        next(err);
    }
}
// ============================================================================
// ADMIN USER ROUTE HANDLERS
// ============================================================================
async function listUsers(_req, res, next) {
    try {
        const users = await dbAll('SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at ASC');
        res.json({ data: users });
    }
    catch (err) {
        next(err);
    }
}
async function createUser(req, res, next) {
    try {
        const { email, password, role = 'user' } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required', code: 'VALIDATION_ERROR' });
        }
        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or user', code: 'VALIDATION_ERROR' });
        }
        const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already in use', code: 'CONFLICT' });
        }
        const id = randomUUID();
        const hash = await bcrypt.hash(password, 12);
        await dbRun('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [id, email, hash, role]);
        const user = await dbGet('SELECT id, email, role, is_active, created_at FROM users WHERE id = ?', [id]);
        res.status(201).json({ data: user });
    }
    catch (err) {
        next(err);
    }
}
async function updateUser(req, res, next) {
    try {
        const { id } = req.params;
        const { password, is_active, role } = req.body;
        const user = await dbGet('SELECT id, email, role, is_active, created_at, password_hash FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        }
        const fields = [];
        const params = [];
        if (password !== undefined) {
            fields.push('password_hash = ?');
            params.push(await bcrypt.hash(password, 12));
        }
        if (is_active !== undefined) {
            fields.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (role !== undefined) {
            if (!['admin', 'user'].includes(role)) {
                return res.status(400).json({ error: 'Role must be admin or user', code: 'VALIDATION_ERROR' });
            }
            fields.push('role = ?');
            params.push(role);
        }
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
        }
        params.push(id);
        await dbRun(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
        const updated = await dbGet('SELECT id, email, role, is_active, created_at FROM users WHERE id = ?', [id]);
        res.json({ data: updated });
    }
    catch (err) {
        next(err);
    }
}
async function deleteUser(req, res, next) {
    try {
        const { id } = req.params;
        const user = await dbGet('SELECT id, role FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        }
        if (user.role === 'admin') {
            const adminCount = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
            if ((adminCount?.count || 0) <= 1) {
                return res.status(409).json({ error: 'Cannot delete the last admin account', code: 'CONFLICT' });
            }
        }
        await dbRun('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'User deleted' });
    }
    catch (err) {
        next(err);
    }
}
// ============================================================================
// DATA ROUTE HANDLERS
// ============================================================================
async function getCustomers(req, res, next) {
    try {
        const query = CustomerParamsSchema.parse(req.query);
        const conditions = [];
        const params = [];
        if (query.search) {
            conditions.push('(c.name LIKE ? OR c.email LIKE ?)');
            params.push(`%${query.search}%`, `%${query.search}%`);
        }
        if (query.status) {
            conditions.push('ms.health_score = ?');
            params.push(query.status);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await dbGet(`SELECT COUNT(*) as count FROM customers c
       LEFT JOIN modem_stats ms ON ms.customer_id = c.id
       ${where}`, params);
        const total = countResult?.count || 0;
        const customers = await dbAll(`SELECT c.id, c.name, c.email, c.created_at, c.updated_at, ms.health_score
       FROM customers c
       LEFT JOIN modem_stats ms ON ms.customer_id = c.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`, [...params, query.limit, query.offset]);
        const pagination = {
            total,
            limit: query.limit,
            offset: query.offset,
            hasMore: query.offset + query.limit < total,
        };
        res.json({
            data: customers,
            pagination,
        });
    }
    catch (err) {
        next(err);
    }
}
async function getCustomerById(req, res, next) {
    try {
        const { id } = req.params;
        const customer = await dbGet('SELECT id, name, email, created_at, updated_at FROM customers WHERE id = ?', [id]);
        if (!customer) {
            return res.status(404).json({
                error: 'Customer not found',
                code: 'NOT_FOUND',
            });
        }
        res.json({ data: customer });
    }
    catch (err) {
        next(err);
    }
}
async function getModemStats(req, res, next) {
    try {
        const { customerId } = req.params;
        const stat = await dbGet(`SELECT id, customer_id, latency, jitter, packet_loss, snr,
              health_score, recorded_at
       FROM modem_stats
       WHERE customer_id = ?
       ORDER BY recorded_at DESC
       LIMIT 1`, [customerId]);
        if (!stat) {
            return res.status(404).json({
                error: 'Modem stats not found',
                code: 'NOT_FOUND',
            });
        }
        res.json({ data: stat });
    }
    catch (err) {
        next(err);
    }
}
async function getModemHistory(req, res, next) {
    try {
        const { customerId } = req.params;
        const query = HistoryParamsSchema.parse(req.query);
        const now = new Date();
        const startDate = new Date(now.getTime() - query.days * 24 * 60 * 60 * 1000);
        const startDateISO = startDate.toISOString();
        const countResult = await dbGet(`SELECT COUNT(*) as count
       FROM modem_history
       WHERE customer_id = ? AND recorded_at >= ?`, [customerId, startDateISO]);
        const total = countResult?.count || 0;
        const allRecords = await dbAll(`SELECT id, customer_id, latency, jitter, packet_loss, snr,
              health_score, recorded_at
       FROM modem_history
       WHERE customer_id = ? AND recorded_at >= ?
       ORDER BY recorded_at ASC`, [customerId, startDateISO]);
        let samplingApplied = false;
        let data = allRecords;
        if (allRecords.length > query.limit) {
            samplingApplied = true;
            const step = Math.ceil(allRecords.length / query.limit);
            data = allRecords.filter((_, index) => index % step === 0);
            data = data.slice(0, query.limit);
        }
        const pagination = {
            total,
            limit: query.limit,
            offset: 0,
            hasMore: false,
        };
        res.json({
            data,
            pagination,
            samplingApplied,
        });
    }
    catch (err) {
        next(err);
    }
}
async function getFleetSummary(req, res, next) {
    try {
        const summary = await dbGet(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN health_score = 'Good' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN health_score = 'Warn' THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN health_score = 'Bad' THEN 1 ELSE 0 END) as critical
       FROM modem_stats`);
        if (!summary) {
            return res.status(500).json({
                error: 'Failed to calculate fleet summary',
                code: 'INTERNAL_ERROR',
            });
        }
        res.json({
            data: {
                total: summary.total || 0,
                healthy: summary.healthy || 0,
                warning: summary.warning || 0,
                critical: summary.critical || 0,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
async function getWorstPerformers(req, res, next) {
    try {
        const query = WorstPerformersParamsSchema.parse(req.query);
        let whereClause = '1 = 1';
        const params = [];
        if (query.status) {
            whereClause += ' AND ms.health_score = ?';
            params.push(query.status);
        }
        const performers = await dbAll(`SELECT
        ms.id,
        ms.customer_id,
        c.name,
        ms.latency,
        ms.jitter,
        ms.packet_loss,
        ms.snr,
        ms.health_score,
        ms.recorded_at
       FROM modem_stats ms
       LEFT JOIN customers c ON ms.customer_id = c.id
       WHERE ${whereClause}
       ORDER BY
         CASE
           WHEN ms.health_score = 'Bad' THEN 1
           WHEN ms.health_score = 'Warn' THEN 2
           WHEN ms.health_score = 'Good' THEN 3
           ELSE 4
         END ASC,
         ms.latency DESC,
         ms.packet_loss DESC
       LIMIT ?`, [...params, query.limit]);
        res.json({
            data: performers,
        });
    }
    catch (err) {
        next(err);
    }
}
async function streamModemStats(req, res, next) {
    try {
        const { customerId } = req.params;
        const customer = await dbGet('SELECT id FROM customers WHERE id = ?', [customerId]);
        if (!customer) {
            return res.status(404).json({
                error: 'Customer not found',
                code: 'NOT_FOUND',
            });
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.write('event: connect\n');
        res.write(`data: ${JSON.stringify({ message: 'Connected to modem stream' })}\n\n`);
        const interval = setInterval(async () => {
            try {
                const stat = await dbGet(`SELECT id, customer_id, latency, jitter, packet_loss, snr,
                  health_score, recorded_at
           FROM modem_stats
           WHERE customer_id = ?
           ORDER BY recorded_at DESC
           LIMIT 1`, [customerId]);
                if (stat) {
                    res.write('event: stats\n');
                    res.write(`data: ${JSON.stringify(stat)}\n\n`);
                }
            }
            catch (err) {
                console.error('Error fetching stats in stream:', err);
                res.write('event: error\n');
                res.write(`data: ${JSON.stringify({ error: 'Failed to fetch stats' })}\n\n`);
            }
        }, 5000);
        req.on('close', () => {
            clearInterval(interval);
            res.end();
        });
        req.on('error', () => {
            clearInterval(interval);
            res.end();
        });
    }
    catch (err) {
        next(err);
    }
}
// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;
const FleetHistoryParamsSchema = z.object({
    days: z
        .string()
        .optional()
        .default('30')
        .pipe(z.coerce.number().int())
        .refine((v) => [7, 30, 90].includes(v), { message: 'days must be 7, 30, or 90' }),
});
async function getNetworkHistory(req, res, next) {
    try {
        const { days } = FleetHistoryParamsSchema.parse(req.query);
        const since = `-${days} days`;
        const daily = await dbAll(`SELECT
        date(recorded_at) as date,
        ROUND(AVG(latency),      2) as avg_latency,
        ROUND(MIN(latency),      2) as min_latency,
        ROUND(MAX(latency),      2) as max_latency,
        ROUND(AVG(packet_loss),  2) as avg_packet_loss,
        ROUND(MIN(packet_loss),  2) as min_packet_loss,
        ROUND(MAX(packet_loss),  2) as max_packet_loss,
        ROUND(AVG(jitter),       2) as avg_jitter,
        ROUND(MIN(jitter),       2) as min_jitter,
        ROUND(MAX(jitter),       2) as max_jitter,
        ROUND(AVG(snr),          2) as avg_snr,
        ROUND(MIN(snr),          2) as min_snr,
        ROUND(MAX(snr),          2) as max_snr,
        ROUND(SUM(CASE WHEN health_score='Good' THEN 1.0 ELSE 0 END)*100/COUNT(*), 1) as pct_good,
        ROUND(SUM(CASE WHEN health_score='Warn' THEN 1.0 ELSE 0 END)*100/COUNT(*), 1) as pct_warn,
        ROUND(SUM(CASE WHEN health_score='Bad'  THEN 1.0 ELSE 0 END)*100/COUNT(*), 1) as pct_bad,
        COUNT(*) as sample_count
       FROM modem_history
       WHERE recorded_at >= datetime('now', ?)
       GROUP BY date(recorded_at)
       ORDER BY date ASC`, [since]);
        const dist = await dbGet(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN latency <= 20                      THEN 1 ELSE 0 END) as lat_0,
        SUM(CASE WHEN latency > 20  AND latency <= 50    THEN 1 ELSE 0 END) as lat_1,
        SUM(CASE WHEN latency > 50  AND latency <= 100   THEN 1 ELSE 0 END) as lat_2,
        SUM(CASE WHEN latency > 100 AND latency <= 200   THEN 1 ELSE 0 END) as lat_3,
        SUM(CASE WHEN latency > 200                      THEN 1 ELSE 0 END) as lat_4,
        SUM(CASE WHEN packet_loss <= 0.5                 THEN 1 ELSE 0 END) as pl_0,
        SUM(CASE WHEN packet_loss > 0.5  AND packet_loss <= 1   THEN 1 ELSE 0 END) as pl_1,
        SUM(CASE WHEN packet_loss > 1    AND packet_loss <= 5   THEN 1 ELSE 0 END) as pl_2,
        SUM(CASE WHEN packet_loss > 5    AND packet_loss <= 10  THEN 1 ELSE 0 END) as pl_3,
        SUM(CASE WHEN packet_loss > 10                   THEN 1 ELSE 0 END) as pl_4,
        SUM(CASE WHEN jitter <= 5                        THEN 1 ELSE 0 END) as jit_0,
        SUM(CASE WHEN jitter > 5  AND jitter <= 10       THEN 1 ELSE 0 END) as jit_1,
        SUM(CASE WHEN jitter > 10 AND jitter <= 20       THEN 1 ELSE 0 END) as jit_2,
        SUM(CASE WHEN jitter > 20 AND jitter <= 50       THEN 1 ELSE 0 END) as jit_3,
        SUM(CASE WHEN jitter > 50                        THEN 1 ELSE 0 END) as jit_4,
        SUM(CASE WHEN snr > 35                           THEN 1 ELSE 0 END) as snr_0,
        SUM(CASE WHEN snr > 30 AND snr <= 35             THEN 1 ELSE 0 END) as snr_1,
        SUM(CASE WHEN snr > 25 AND snr <= 30             THEN 1 ELSE 0 END) as snr_2,
        SUM(CASE WHEN snr > 20 AND snr <= 25             THEN 1 ELSE 0 END) as snr_3,
        SUM(CASE WHEN snr <= 20                          THEN 1 ELSE 0 END) as snr_4
       FROM modem_history
       WHERE recorded_at >= datetime('now', ?)`, [since]);
        const total = dist?.total || 1;
        const pct = (n) => Math.round((n / total) * 100);
        const summary = daily.length > 0 ? {
            avg_latency: Math.round(daily.reduce((s, d) => s + d.avg_latency, 0) / daily.length * 10) / 10,
            avg_packet_loss: Math.round(daily.reduce((s, d) => s + d.avg_packet_loss, 0) / daily.length * 10) / 10,
            avg_jitter: Math.round(daily.reduce((s, d) => s + d.avg_jitter, 0) / daily.length * 10) / 10,
            avg_snr: Math.round(daily.reduce((s, d) => s + d.avg_snr, 0) / daily.length * 10) / 10,
        } : { avg_latency: 0, avg_packet_loss: 0, avg_jitter: 0, avg_snr: 0 };
        res.json({
            data: {
                days,
                summary,
                daily,
                distribution: {
                    total,
                    latency: [pct(dist.lat_0), pct(dist.lat_1), pct(dist.lat_2), pct(dist.lat_3), pct(dist.lat_4)],
                    packet_loss: [pct(dist.pl_0), pct(dist.pl_1), pct(dist.pl_2), pct(dist.pl_3), pct(dist.pl_4)],
                    jitter: [pct(dist.jit_0), pct(dist.jit_1), pct(dist.jit_2), pct(dist.jit_3), pct(dist.jit_4)],
                    snr: [pct(dist.snr_0), pct(dist.snr_1), pct(dist.snr_2), pct(dist.snr_3), pct(dist.snr_4)],
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
}
async function getFleetDistribution(req, res, next) {
    try {
        const row = await dbGet(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN latency <= 20                    THEN 1 ELSE 0 END) as lat_0,
        SUM(CASE WHEN latency > 20  AND latency <= 50  THEN 1 ELSE 0 END) as lat_1,
        SUM(CASE WHEN latency > 50  AND latency <= 100 THEN 1 ELSE 0 END) as lat_2,
        SUM(CASE WHEN latency > 100 AND latency <= 200 THEN 1 ELSE 0 END) as lat_3,
        SUM(CASE WHEN latency > 200                    THEN 1 ELSE 0 END) as lat_4,
        SUM(CASE WHEN packet_loss <= 0.5                           THEN 1 ELSE 0 END) as pl_0,
        SUM(CASE WHEN packet_loss > 0.5  AND packet_loss <= 1      THEN 1 ELSE 0 END) as pl_1,
        SUM(CASE WHEN packet_loss > 1    AND packet_loss <= 5      THEN 1 ELSE 0 END) as pl_2,
        SUM(CASE WHEN packet_loss > 5    AND packet_loss <= 10     THEN 1 ELSE 0 END) as pl_3,
        SUM(CASE WHEN packet_loss > 10                             THEN 1 ELSE 0 END) as pl_4,
        SUM(CASE WHEN jitter <= 5                    THEN 1 ELSE 0 END) as jit_0,
        SUM(CASE WHEN jitter > 5  AND jitter <= 10   THEN 1 ELSE 0 END) as jit_1,
        SUM(CASE WHEN jitter > 10 AND jitter <= 20   THEN 1 ELSE 0 END) as jit_2,
        SUM(CASE WHEN jitter > 20 AND jitter <= 50   THEN 1 ELSE 0 END) as jit_3,
        SUM(CASE WHEN jitter > 50                    THEN 1 ELSE 0 END) as jit_4,
        SUM(CASE WHEN snr > 35                   THEN 1 ELSE 0 END) as snr_0,
        SUM(CASE WHEN snr > 30 AND snr <= 35     THEN 1 ELSE 0 END) as snr_1,
        SUM(CASE WHEN snr > 25 AND snr <= 30     THEN 1 ELSE 0 END) as snr_2,
        SUM(CASE WHEN snr > 20 AND snr <= 25     THEN 1 ELSE 0 END) as snr_3,
        SUM(CASE WHEN snr <= 20                  THEN 1 ELSE 0 END) as snr_4
       FROM modem_stats`);
        if (!row)
            return res.status(500).json({ error: 'Failed to compute distribution', code: 'INTERNAL_ERROR' });
        const total = row.total || 1;
        const pct = (n) => Math.round((n / total) * 100);
        res.json({
            data: {
                total,
                latency: [pct(row.lat_0), pct(row.lat_1), pct(row.lat_2), pct(row.lat_3), pct(row.lat_4)],
                packet_loss: [pct(row.pl_0), pct(row.pl_1), pct(row.pl_2), pct(row.pl_3), pct(row.pl_4)],
                jitter: [pct(row.jit_0), pct(row.jit_1), pct(row.jit_2), pct(row.jit_3), pct(row.jit_4)],
                snr: [pct(row.snr_0), pct(row.snr_1), pct(row.snr_2), pct(row.snr_3), pct(row.snr_4)],
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ============================================================================
// ROUTES
// ============================================================================
app.use(cors);
app.use(express.json());
app.use(cookieParser());
// Auth routes (public)
app.post('/api/auth/login', handleLogin);
app.post('/api/auth/logout', handleLogout);
app.get('/api/auth/me', requireAuth, handleMe);
// Admin routes
app.get('/api/admin/users', requireAdmin, listUsers);
app.post('/api/admin/users', requireAdmin, createUser);
app.patch('/api/admin/users/:id', requireAdmin, updateUser);
app.delete('/api/admin/users/:id', requireAdmin, deleteUser);
// Data routes (require auth)
app.get('/api/customers', requireAuth, getCustomers);
app.get('/api/customers/:id', requireAuth, getCustomerById);
app.get('/api/modems/:customerId/stats', requireAuth, getModemStats);
app.get('/api/modems/:customerId/history', requireAuth, getModemHistory);
app.get('/api/fleet/summary', requireAuth, getFleetSummary);
app.get('/api/fleet/worst-performers', requireAuth, getWorstPerformers);
app.get('/api/fleet/distribution', requireAuth, getFleetDistribution);
app.get('/api/fleet/network-history', requireAuth, getNetworkHistory);
app.get('/api/stream/modems/:customerId', streamModemStats);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Error handling
app.use(errorHandler);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        error: 'Not found',
        code: 'NOT_FOUND',
    });
});
// ============================================================================
// SERVER STARTUP
// ============================================================================
const server = app.listen(PORT, () => {
    console.log(`SmartView v2 Backend API listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`CORS enabled for all origins`);
});
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        db.close(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});
export default app;
//# sourceMappingURL=index.js.map
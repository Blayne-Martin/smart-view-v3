/**
 * SmartView v2 Backend - Utility Functions
 * Helper functions for sampling, pagination, and data manipulation
 */
import { ZodError } from 'zod';
// ============================================================================
// SAMPLING UTILITIES
// ============================================================================
/**
 * Apply evenly-spaced downsampling to array of records
 * Maintains temporal order and ensures output doesn't exceed limit
 *
 * @param records - Array of records to sample
 * @param limit - Maximum records to return
 * @returns Tuple of [sampledRecords, samplingApplied]
 */
export function applySampling(records, limit) {
    if (records.length <= limit) {
        return [records, false];
    }
    const step = Math.ceil(records.length / limit);
    const sampled = records.filter((_, index) => index % step === 0);
    // Guarantee we don't exceed limit
    return [sampled.slice(0, limit), true];
}
/**
 * Calculate optimal sampling step size
 * Useful for progressive sampling strategies
 */
export function calculateSamplingStep(totalRecords, targetPoints) {
    if (totalRecords <= targetPoints)
        return 1;
    return Math.ceil(totalRecords / targetPoints);
}
export function calculatePaginationMeta(input) {
    return {
        ...input,
        hasMore: input.offset + input.limit < input.total,
    };
}
/**
 * Validate pagination parameters
 */
export function isValidPagination(limit, offset, maxLimit = 100) {
    return limit >= 1 && limit <= maxLimit && offset >= 0 && Number.isInteger(limit) && Number.isInteger(offset);
}
/**
 * Calculate total pages from pagination metadata
 */
export function calculateTotalPages(pagination) {
    return Math.ceil(pagination.total / pagination.limit);
}
/**
 * Get current page number from offset and limit
 */
export function getCurrentPageNumber(offset, limit) {
    return Math.floor(offset / limit) + 1;
}
// ============================================================================
// TIME RANGE UTILITIES
// ============================================================================
/**
 * Validate days parameter
 */
export const VALID_DAYS = [1, 7, 30, 90];
export function isValidDays(days) {
    return VALID_DAYS.includes(days);
}
/**
 * Calculate start date for time-range query
 * @param days - Number of days in the past
 * @param baseDate - Reference date (default: now)
 */
export function calculateStartDate(days, baseDate = new Date()) {
    const start = new Date(baseDate);
    start.setDate(start.getDate() - days);
    return start;
}
/**
 * Format date to ISO string for database queries
 */
export function toISO(date) {
    return date.toISOString();
}
/**
 * Convert ISO string to JavaScript Date
 */
export function fromISO(isoString) {
    return new Date(isoString);
}
// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================
/**
 * Format Zod validation error to API response
 */
export function formatZodError(error) {
    return {
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: error.errors.map((err) => ({
            path: err.path,
            message: err.message,
        })),
    };
}
/**
 * Standard error response builder
 */
export function buildErrorResponse(error, code, details) {
    return {
        error,
        code,
        ...(details && { details }),
    };
}
/**
 * Check if error is a Zod validation error
 */
export function isZodError(error) {
    return error instanceof ZodError;
}
// ============================================================================
// MIDDLEWARE UTILITIES
// ============================================================================
/**
 * Create async route wrapper to handle promises
 * Eliminates need for try-catch in route handlers
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
/**
 * Schema validation middleware factory
 */
export function validateSchema(schema) {
    return asyncHandler(async (req, res, next) => {
        try {
            const validated = await schema.parseAsync(req.query);
            req.query = validated;
            next();
        }
        catch (error) {
            if (isZodError(error)) {
                return res.status(400).json(formatZodError(error));
            }
            next(error);
        }
    });
}
// ============================================================================
// DATA TRANSFORMATION UTILITIES
// ============================================================================
/**
 * Ensure field exists in record before access
 */
export function safeGet(obj, key, fallback) {
    return (obj?.[key] ?? fallback);
}
/**
 * Filter out undefined/null values from object
 */
export function compactObject(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}
/**
 * Transform snake_case keys to camelCase (for database fields)
 */
export function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}
/**
 * Transform camelCase keys to snake_case (for database fields)
 */
export function camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================
/**
 * Measure function execution time
 */
export async function measureTime(fn, label = 'Operation') {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`[${label}] Completed in ${duration.toFixed(2)}ms`);
    return [result, duration];
}
/**
 * Simple cache decorator for async functions
 */
export function createCache(ttlMs = 60000) {
    const cache = new Map();
    return {
        get(key) {
            const cached = cache.get(key);
            if (!cached)
                return null;
            if (Date.now() > cached.expiresAt) {
                cache.delete(key);
                return null;
            }
            return cached.value;
        },
        set(key, value) {
            cache.set(key, {
                value,
                expiresAt: Date.now() + ttlMs,
            });
        },
        clear() {
            cache.clear();
        },
        async getOrSet(key, fn) {
            const cached = this.get(key);
            if (cached)
                return cached;
            const value = await fn();
            this.set(key, value);
            return value;
        },
    };
}
// ============================================================================
// LOGGING UTILITIES
// ============================================================================
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export function createLogger(level = LogLevel.INFO) {
    return {
        debug: (msg, data) => {
            if (level <= LogLevel.DEBUG)
                console.debug(`[DEBUG] ${msg}`, data || '');
        },
        info: (msg, data) => {
            if (level <= LogLevel.INFO)
                console.log(`[INFO] ${msg}`, data || '');
        },
        warn: (msg, data) => {
            if (level <= LogLevel.WARN)
                console.warn(`[WARN] ${msg}`, data || '');
        },
        error: (msg, err) => {
            if (level <= LogLevel.ERROR) {
                if (err instanceof Error) {
                    console.error(`[ERROR] ${msg}:`, err.message, err.stack);
                }
                else {
                    console.error(`[ERROR] ${msg}:`, err);
                }
            }
        },
    };
}
// ============================================================================
// TYPE GUARDS
// ============================================================================
/**
 * Check if object is a valid date
 */
export function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}
/**
 * Check if object is plain object (not class instance)
 */
export function isPlainObject(obj) {
    return obj !== null && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype;
}
/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
/**
 * Check if array has items
 */
export function hasItems(arr) {
    return Array.isArray(arr) && arr.length > 0;
}
//# sourceMappingURL=utils.js.map
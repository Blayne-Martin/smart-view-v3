/**
 * SmartView v2 Backend - Utility Functions
 * Helper functions for sampling, pagination, and data manipulation
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

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
export function applySampling<T>(records: T[], limit: number): [T[], boolean] {
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
export function calculateSamplingStep(totalRecords: number, targetPoints: number): number {
  if (totalRecords <= targetPoints) return 1;
  return Math.ceil(totalRecords / targetPoints);
}

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

/**
 * Calculate pagination metadata
 */
export interface PaginationInput {
  total: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta extends PaginationInput {
  hasMore: boolean;
}

export function calculatePaginationMeta(input: PaginationInput): PaginationMeta {
  return {
    ...input,
    hasMore: input.offset + input.limit < input.total,
  };
}

/**
 * Validate pagination parameters
 */
export function isValidPagination(limit: number, offset: number, maxLimit: number = 100): boolean {
  return limit >= 1 && limit <= maxLimit && offset >= 0 && Number.isInteger(limit) && Number.isInteger(offset);
}

/**
 * Calculate total pages from pagination metadata
 */
export function calculateTotalPages(pagination: PaginationMeta): number {
  return Math.ceil(pagination.total / pagination.limit);
}

/**
 * Get current page number from offset and limit
 */
export function getCurrentPageNumber(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1;
}

// ============================================================================
// TIME RANGE UTILITIES
// ============================================================================

/**
 * Validate days parameter
 */
export const VALID_DAYS = [1, 7, 30, 90] as const;
export type ValidDays = typeof VALID_DAYS[number];

export function isValidDays(days: number): days is ValidDays {
  return VALID_DAYS.includes(days as ValidDays);
}

/**
 * Calculate start date for time-range query
 * @param days - Number of days in the past
 * @param baseDate - Reference date (default: now)
 */
export function calculateStartDate(days: number, baseDate: Date = new Date()): Date {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - days);
  return start;
}

/**
 * Format date to ISO string for database queries
 */
export function toISO(date: Date): string {
  return date.toISOString();
}

/**
 * Convert ISO string to JavaScript Date
 */
export function fromISO(isoString: string): Date {
  return new Date(isoString);
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Format Zod validation error to API response
 */
export function formatZodError(error: ZodError) {
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
export function buildErrorResponse(error: string, code: string, details?: any) {
  return {
    error,
    code,
    ...(details && { details }),
  };
}

/**
 * Check if error is a Zod validation error
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

// ============================================================================
// MIDDLEWARE UTILITIES
// ============================================================================

/**
 * Create async route wrapper to handle promises
 * Eliminates need for try-catch in route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Schema validation middleware factory
 */
export function validateSchema(schema: ZodSchema) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
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
export function safeGet<T, K extends keyof T>(obj: T, key: K, fallback?: T[K]): T[K] {
  return (obj?.[key] ?? fallback) as T[K];
}

/**
 * Filter out undefined/null values from object
 */
export function compactObject<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as Partial<T>;
}

/**
 * Transform snake_case keys to camelCase (for database fields)
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Transform camelCase keys to snake_case (for database fields)
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Measure function execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T>,
  label: string = 'Operation'
): Promise<[T, number]> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  console.log(`[${label}] Completed in ${duration.toFixed(2)}ms`);
  return [result, duration];
}

/**
 * Simple cache decorator for async functions
 */
export function createCache<T>(ttlMs: number = 60000) {
  const cache = new Map<string, { value: T; expiresAt: number }>();

  return {
    get(key: string): T | null {
      const cached = cache.get(key);
      if (!cached) return null;
      if (Date.now() > cached.expiresAt) {
        cache.delete(key);
        return null;
      }
      return cached.value;
    },

    set(key: string, value: T): void {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },

    clear(): void {
      cache.clear();
    },

    async getOrSet(key: string, fn: () => Promise<T>): Promise<T> {
      const cached = this.get(key);
      if (cached) return cached;

      const value = await fn();
      this.set(key, value);
      return value;
    },
  };
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export function createLogger(level: LogLevel = LogLevel.INFO) {
  return {
    debug: (msg: string, data?: any) => {
      if (level <= LogLevel.DEBUG) console.debug(`[DEBUG] ${msg}`, data || '');
    },
    info: (msg: string, data?: any) => {
      if (level <= LogLevel.INFO) console.log(`[INFO] ${msg}`, data || '');
    },
    warn: (msg: string, data?: any) => {
      if (level <= LogLevel.WARN) console.warn(`[WARN] ${msg}`, data || '');
    },
    error: (msg: string, err?: Error | any) => {
      if (level <= LogLevel.ERROR) {
        if (err instanceof Error) {
          console.error(`[ERROR] ${msg}:`, err.message, err.stack);
        } else {
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
export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Check if object is plain object (not class instance)
 */
export function isPlainObject(obj: unknown): obj is Record<string, any> {
  return obj !== null && typeof obj === 'object' && Object.getPrototypeOf(obj) === Object.prototype;
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if array has items
 */
export function hasItems<T>(arr: T[]): arr is T[] & { length: 1 } {
  return Array.isArray(arr) && arr.length > 0;
}

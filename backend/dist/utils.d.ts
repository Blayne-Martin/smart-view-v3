/**
 * SmartView v2 Backend - Utility Functions
 * Helper functions for sampling, pagination, and data manipulation
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
/**
 * Apply evenly-spaced downsampling to array of records
 * Maintains temporal order and ensures output doesn't exceed limit
 *
 * @param records - Array of records to sample
 * @param limit - Maximum records to return
 * @returns Tuple of [sampledRecords, samplingApplied]
 */
export declare function applySampling<T>(records: T[], limit: number): [T[], boolean];
/**
 * Calculate optimal sampling step size
 * Useful for progressive sampling strategies
 */
export declare function calculateSamplingStep(totalRecords: number, targetPoints: number): number;
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
export declare function calculatePaginationMeta(input: PaginationInput): PaginationMeta;
/**
 * Validate pagination parameters
 */
export declare function isValidPagination(limit: number, offset: number, maxLimit?: number): boolean;
/**
 * Calculate total pages from pagination metadata
 */
export declare function calculateTotalPages(pagination: PaginationMeta): number;
/**
 * Get current page number from offset and limit
 */
export declare function getCurrentPageNumber(offset: number, limit: number): number;
/**
 * Validate days parameter
 */
export declare const VALID_DAYS: readonly [1, 7, 30, 90];
export type ValidDays = typeof VALID_DAYS[number];
export declare function isValidDays(days: number): days is ValidDays;
/**
 * Calculate start date for time-range query
 * @param days - Number of days in the past
 * @param baseDate - Reference date (default: now)
 */
export declare function calculateStartDate(days: number, baseDate?: Date): Date;
/**
 * Format date to ISO string for database queries
 */
export declare function toISO(date: Date): string;
/**
 * Convert ISO string to JavaScript Date
 */
export declare function fromISO(isoString: string): Date;
/**
 * Format Zod validation error to API response
 */
export declare function formatZodError(error: ZodError): {
    error: string;
    code: string;
    details: {
        path: (string | number)[];
        message: string;
    }[];
};
/**
 * Standard error response builder
 */
export declare function buildErrorResponse(error: string, code: string, details?: any): any;
/**
 * Check if error is a Zod validation error
 */
export declare function isZodError(error: unknown): error is ZodError;
/**
 * Create async route wrapper to handle promises
 * Eliminates need for try-catch in route handlers
 */
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Schema validation middleware factory
 */
export declare function validateSchema(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Ensure field exists in record before access
 */
export declare function safeGet<T, K extends keyof T>(obj: T, key: K, fallback?: T[K]): T[K];
/**
 * Filter out undefined/null values from object
 */
export declare function compactObject<T extends Record<string, any>>(obj: T): Partial<T>;
/**
 * Transform snake_case keys to camelCase (for database fields)
 */
export declare function snakeToCamel(str: string): string;
/**
 * Transform camelCase keys to snake_case (for database fields)
 */
export declare function camelToSnake(str: string): string;
/**
 * Measure function execution time
 */
export declare function measureTime<T>(fn: () => Promise<T>, label?: string): Promise<[T, number]>;
/**
 * Simple cache decorator for async functions
 */
export declare function createCache<T>(ttlMs?: number): {
    get(key: string): T | null;
    set(key: string, value: T): void;
    clear(): void;
    getOrSet(key: string, fn: () => Promise<T>): Promise<T>;
};
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare function createLogger(level?: LogLevel): {
    debug: (msg: string, data?: any) => void;
    info: (msg: string, data?: any) => void;
    warn: (msg: string, data?: any) => void;
    error: (msg: string, err?: Error | any) => void;
};
/**
 * Check if object is a valid date
 */
export declare function isValidDate(date: any): date is Date;
/**
 * Check if object is plain object (not class instance)
 */
export declare function isPlainObject(obj: unknown): obj is Record<string, any>;
/**
 * Check if value is a non-empty string
 */
export declare function isNonEmptyString(value: unknown): value is string;
/**
 * Check if array has items
 */
export declare function hasItems<T>(arr: T[]): arr is T[] & {
    length: 1;
};
//# sourceMappingURL=utils.d.ts.map
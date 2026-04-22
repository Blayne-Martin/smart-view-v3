import request from 'supertest';
import app from './index';

/**
 * SmartView v2 API Tests
 * Comprehensive test suite for P0 and P1 features
 */

describe('SmartView v2 Backend API', () => {
  // ========================================================================
  // P0 TESTS: PAGINATION & FILTERING
  // ========================================================================

  describe('P0: Pagination & Filtering', () => {
    describe('GET /api/customers', () => {
      it('should return paginated customer list with default limit', async () => {
        const res = await request(app).get('/api/customers');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should respect custom limit parameter', async () => {
        const res = await request(app).get('/api/customers?limit=10');

        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBe(10);
      });

      it('should enforce maximum limit of 100', async () => {
        const res = await request(app).get('/api/customers?limit=150');

        expect(res.status).toBe(400);
      });

      it('should respect offset parameter', async () => {
        const res = await request(app).get('/api/customers?offset=20');

        expect(res.status).toBe(200);
        expect(res.body.pagination.offset).toBe(20);
      });

      it('should return pagination metadata', async () => {
        const res = await request(app).get('/api/customers?limit=50&offset=0');

        expect(res.body.pagination).toHaveProperty('total');
        expect(res.body.pagination).toHaveProperty('limit');
        expect(res.body.pagination).toHaveProperty('offset');
        expect(res.body.pagination).toHaveProperty('hasMore');
      });

      it('should correctly calculate hasMore flag', async () => {
        // First page
        const res1 = await request(app).get('/api/customers?limit=10&offset=0');
        const totalCount = res1.body.pagination.total;

        // If we have more than 10 items, hasMore should be true
        if (totalCount > 10) {
          expect(res1.body.pagination.hasMore).toBe(true);
        }

        // Last page should have hasMore = false
        const lastPageRes = await request(app).get(
          `/api/customers?limit=10&offset=${totalCount}`
        );
        expect(lastPageRes.body.pagination.hasMore).toBe(false);
      });
    });

    describe('GET /api/modems/:customerId/history', () => {
      it('should return modem history with default days=7', async () => {
        const res = await request(app).get('/api/modems/customer-1/history');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should filter by days parameter (1, 7, 30, 90)', async () => {
        const daysValues = [1, 7, 30, 90];

        for (const days of daysValues) {
          const res = await request(app).get(
            `/api/modems/customer-1/history?days=${days}`
          );
          expect(res.status).toBe(200);
        }
      });

      it('should reject invalid days parameter', async () => {
        const res = await request(app).get(
          '/api/modems/customer-1/history?days=15'
        );
        expect(res.status).toBe(400);
      });

      it('should apply time-range filtering correctly', async () => {
        // Get history for 1 day
        const res1Day = await request(app).get(
          '/api/modems/customer-1/history?days=1'
        );
        const count1Day = res1Day.body.pagination.total;

        // Get history for 7 days
        const res7Days = await request(app).get(
          '/api/modems/customer-1/history?days=7'
        );
        const count7Days = res7Days.body.pagination.total;

        // 7-day range should have more or equal records
        expect(count7Days).toBeGreaterThanOrEqual(count1Day);
      });
    });
  });

  // ========================================================================
  // P0 TESTS: SERVER-SIDE SAMPLING
  // ========================================================================

  describe('P0: Server-Side Sampling', () => {
    it('should cap modem history to 200 data points maximum', async () => {
      const res = await request(app).get('/api/modems/customer-1/history');

      expect(res.body.data.length).toBeLessThanOrEqual(200);
    });

    it('should apply sampling when data exceeds limit', async () => {
      const res = await request(app).get(
        '/api/modems/customer-1/history?limit=10'
      );

      // If we have many records, sampling might be applied
      if (res.body.pagination.total > 10) {
        expect(res.body.samplingApplied).toBeDefined();
      }
    });

    it('should indicate samplingApplied flag in response', async () => {
      const res = await request(app).get('/api/modems/customer-1/history');

      expect(res.body).toHaveProperty('samplingApplied');
      expect(typeof res.body.samplingApplied).toBe('boolean');
    });

    it('should maintain temporal order after sampling', async () => {
      const res = await request(app).get(
        '/api/modems/customer-1/history?days=30'
      );

      const timestamps = res.body.data.map((d: any) => new Date(d.recorded_at).getTime());

      // Check that timestamps are in ascending order
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  // ========================================================================
  // P0 TESTS: PAGINATION METADATA
  // ========================================================================

  describe('P0: Pagination Metadata', () => {
    it('should return consistent pagination metadata for all endpoints', async () => {
      const res = await request(app).get('/api/customers?limit=25&offset=10');

      expect(res.body.pagination).toEqual({
        total: expect.any(Number),
        limit: 25,
        offset: 10,
        hasMore: expect.any(Boolean),
      });
    });

    it('should return pagination for modem history', async () => {
      const res = await request(app).get(
        '/api/modems/customer-1/history?days=7'
      );

      expect(res.body.pagination).toEqual({
        total: expect.any(Number),
        limit: expect.any(Number),
        offset: expect.any(Number),
        hasMore: expect.any(Boolean),
      });
    });
  });

  // ========================================================================
  // P1 TESTS: SERVER-SENT EVENTS
  // ========================================================================

  describe('P1: Server-Sent Events Stream', () => {
    it('should establish SSE connection on GET /api/stream/modems/:customerId', async () => {
      // Note: Full SSE testing requires a different approach
      // This tests the endpoint setup
      const res = await request(app)
        .get('/api/stream/modems/customer-1')
        .set('Accept', 'text/event-stream');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('should set correct SSE headers', async () => {
      const res = await request(app).get('/api/stream/modems/customer-1');

      expect(res.headers['cache-control']).toContain('no-cache');
      expect(res.headers['connection']).toContain('keep-alive');
    });

    it('should return 404 for non-existent customer', async () => {
      const res = await request(app).get(
        '/api/stream/modems/non-existent-customer'
      );

      expect(res.status).toBe(404);
    });
  });

  // ========================================================================
  // ERROR HANDLING & VALIDATION
  // ========================================================================

  describe('Error Handling & Validation', () => {
    it('should validate limit is positive integer', async () => {
      const res = await request(app).get('/api/customers?limit=-5');

      expect(res.status).toBe(400);
    });

    it('should validate offset is non-negative integer', async () => {
      const res = await request(app).get('/api/customers?offset=-1');

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent customer', async () => {
      const res = await request(app).get(
        '/api/customers/non-existent-id'
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Customer not found');
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should return consistent error shape', async () => {
      const res = await request(app).get('/api/customers?limit=invalid');

      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code');
    });

    it('should return 404 for invalid route', async () => {
      const res = await request(app).get('/api/invalid/route');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ========================================================================
  // HEALTH CHECK
  // ========================================================================

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});

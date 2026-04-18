const express = require('express');
const request = require('supertest');
const createApiContractGuard = require('../middleware/apiContractGuard');

describe('API Contract Guard Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.featureFlags = {
        isEnabled: (flagName, fallbackValue) => {
          if (flagName === 'apiContractEnforcementEnabled') return true;
          if (flagName === 'apiContractStrictModeEnabled') return false;
          return fallbackValue;
        }
      };
      next();
    });

    app.use(createApiContractGuard({
      getEnforcementEnabled: (req) => req.featureFlags.isEnabled('apiContractEnforcementEnabled', true),
      getStrictModeEnabled: (req) => req.featureFlags.isEnabled('apiContractStrictModeEnabled', false)
    }));

    app.get('/api/raw-success', (req, res) => {
      res.json({ users: [{ id: 'u1', username: 'demo' }] });
    });

    app.get('/api/raw-error', (req, res) => {
      res.status(400).json({ error: 'Invalid payload' });
    });

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  });

  test('normalizes success payloads to include success, data, and message', async () => {
    const response = await request(app).get('/api/raw-success');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Request completed');
    expect(response.body.data).toEqual({ users: [{ id: 'u1', username: 'demo' }] });
    expect(response.body.users).toEqual([{ id: 'u1', username: 'demo' }]);
  });

  test('normalizes error payloads and derives fallback data/message', async () => {
    const response = await request(app).get('/api/raw-error');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid payload');
    expect(response.body.data).toBeNull();
  });

  test('skips health routes configured as contract exclusions', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
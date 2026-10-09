import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../src/store.js';
import { createShippingService } from '../src/shipping.js';
import { mockProvider } from '../src/providers/mock.js';
import { createGhnProvider } from '../src/providers/ghn.js';
import { createGhnClient } from '../src/ghn-client.js';
import { createApp } from '../src/app.js';

const sample = JSON.parse(readFileSync(new URL('../examples/order.json', import.meta.url)));
const fresh = () => structuredClone(sample);
test('validation, replay and changed payload', async () => {
  const store = createStore(':memory:');
  try {
    const service = createShippingService(store, mockProvider);
    const invalid = fresh(); invalid.codAmount = -1;
    await assert.rejects(service.create(invalid), { code: 'INVALID_ORDER' });
    const created = await service.create(fresh());
    assert.equal(created.simulated, true);
    assert.match(created.trackingNumber, /^MOCK-/);
    assert.deepEqual(await service.create(fresh()), created);
    const changed = fresh(); changed.codAmount++;
    await assert.rejects(service.create(changed), { code: 'REFERENCE_CONFLICT' });
  } finally { store.close(); }
});
test('concurrent requests invoke provider once', async () => {
  const store = createStore(':memory:');
  let release; let calls = 0;
  const wait = new Promise((resolve) => { release = resolve; });
  const provider = { name: 'ghn', assertReady() {}, async createShipment() { calls++; await wait; return { trackingNumber: 'TEST-123' }; } };
  try {
    const service = createShippingService(store, provider);
    const first = service.create(fresh());
    await assert.rejects(service.create(fresh()), { code: 'SHIPMENT_PENDING' });
    await assert.rejects(service.reconcile(sample.referenceId), { code: 'SHIPMENT_PENDING' });
    release(); await first;
    assert.equal(calls, 1);
  } finally { store.close(); }
});
test('ambiguous outcome blocks resend, including after database restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'shipping-test-'));
  let store = createStore(join(dir, 'orders.sqlite'));
  let calls = 0;
  const provider = { name: 'ghn', assertReady() {}, async createShipment() { calls++; throw new Error('timeout'); } };
  try {
    await assert.rejects(createShippingService(store, provider).create(fresh()), { code: 'SHIPMENT_UNKNOWN' });
    store.close(); store = createStore(join(dir, 'orders.sqlite'));
    const service = createShippingService(store, provider);
    assert.equal(service.get(sample.referenceId).status, 'UNKNOWN');
    await assert.rejects(service.create(fresh()), { code: 'SHIPMENT_PENDING' });
    assert.equal(calls, 1);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('live GHN adapter fails explicitly before reserving a shipment', async () => {
  const store = createStore(':memory:');
  try {
    await assert.rejects(createShippingService(store, createGhnProvider(createGhnClient({}))).create(fresh()), { code: 'GHN_NOT_CONFIGURED' });
    assert.equal(store.get(sample.referenceId), undefined);
  } finally { store.close(); }
});
test('HTTP authentication, origin policy and authenticated creation', async () => {
  const store = createStore(':memory:');
  const server = createApp({ shipping: createShippingService(store, mockProvider), adminPassword: 'test-password-very-private', frontendOrigin: 'http://localhost:5173' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const request = (path, body, headers = {}) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    assert.equal((await request('/api/shipments', fresh())).status, 401);
    assert.equal((await request('/api/auth/login', { password: 'bad' })).status, 401);
    assert.equal((await request('/api/auth/login', {}, { Origin: 'https://other.example' })).status, 403);
    const login = await request('/api/auth/login', { password: 'test-password-very-private' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const response = await request('/api/shipments', fresh(), { Cookie: cookie });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'CREATED');
    assert.equal((await request('/api/auth/logout', {}, { Cookie: cookie })).status, 200);
    assert.equal((await request('/api/shipments', fresh(), { Cookie: cookie })).status, 401);
  } finally { await new Promise((resolve) => server.close(resolve)); store.close(); }
});

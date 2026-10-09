import { resolve } from 'node:path';
import { createStore } from './store.js';
import { createShippingService } from './shipping.js';
import { createApp } from './app.js';
import { mockProvider } from './providers/mock.js';
import { createGhnProvider } from './providers/ghn.js';
import { createGhnClient } from './ghn-client.js';
import { createGhnGateway } from './ghn-gateway.js';

const providerName = process.env.SHIPPING_PROVIDER || 'ghn';
if (!['mock', 'ghn'].includes(providerName)) throw new Error('SHIPPING_PROVIDER phải là mock hoặc ghn');
const production = process.env.NODE_ENV === 'production';
if (production && providerName === 'mock') throw new Error('Không cho phép mock trong production');
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
if (production && !frontendOrigin.startsWith('https://')) throw new Error('Production cần FRONTEND_ORIGIN HTTPS');
const client = createGhnClient({ token: process.env.GHN_TOKEN, shopId: process.env.GHN_SHOP_ID, environment: process.env.GHN_ENV || 'staging' });
const store = createStore(resolve(process.env.DATABASE_PATH || './data/ghn-orders.sqlite'));
const shipping = createShippingService(store, providerName === 'ghn' ? createGhnProvider(client) : mockProvider);
const server = createApp({ shipping, ghnGateway: createGhnGateway(client), adminPassword: process.env.ADMIN_PASSWORD, frontendOrigin, secureCookies: production });
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ');
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Shipping server port ${port}; provider=${providerName}; GHN_ENV=${client.environment}`));
function shutdown() { server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

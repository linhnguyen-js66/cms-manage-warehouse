import { createHash } from 'node:crypto';

export const mockProvider = {
  name: 'mock',
  assertReady() {},
  async createShipment(order) {
    return {
      trackingNumber: `MOCK-${createHash('sha256').update(order.referenceId).digest('hex').slice(0, 16).toUpperCase()}`,
    };
  },
};

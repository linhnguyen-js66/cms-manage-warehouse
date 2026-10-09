import { createHash } from 'node:crypto';
import { HttpError } from './errors.js';
import { validateOrder } from './validation.js';
import { validateRawCreate } from './ghn-validation.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}
export function publicShipment(row) {
  return {
    referenceId: row.reference_id, provider: row.provider.split(':')[0],
    environment: row.provider.split(':')[1] || null,
    status: row.status, simulated: row.provider === 'mock', trackingNumber: row.tracking_number,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
export function createShippingService(store, provider) {
  const identity = provider.identity || provider.name;
  const active = new Set();
  async function submit(order) {
    const hash = createHash('sha256').update(JSON.stringify(canonical(order))).digest('hex');
    let row = store.get(order.referenceId);
    if (row && row.provider !== identity) throw new HttpError(409, 'REFERENCE_CONFLICT', 'Mã đơn đã dùng ở hãng/shop/môi trường khác');
    if (row?.status === 'REJECTED' || !row) {
      provider.assertReady();
      const reserved = row ? store.retry(order, hash, identity) : store.reserve(order, hash, identity);
      if (reserved) {
        active.add(order.referenceId);
        try {
          const result = await provider.createShipment(order);
          if (typeof result?.trackingNumber !== 'string' || !result.trackingNumber.trim()) throw new Error('Missing tracking number');
          store.finish(order.referenceId, 'CREATED', result.trackingNumber.trim());
          return publicShipment(store.get(order.referenceId));
        } catch (error) {
          const rejected = error instanceof HttpError && error.code === 'GHN_REJECTED';
          store.finish(order.referenceId, rejected ? 'REJECTED' : 'UNKNOWN');
          if (rejected) throw error;
          throw new HttpError(502, 'SHIPMENT_UNKNOWN', 'Chưa rõ kết quả gửi. Dùng reconcile/tra cứu GHN trước khi tạo lại.');
        } finally { active.delete(order.referenceId); }
      }
      row = store.get(order.referenceId);
    }
    if (row.payload_hash !== hash) throw new HttpError(409, 'REFERENCE_CONFLICT', 'Mã đơn đã dùng với dữ liệu khác');
    if (row.status === 'CREATED') return publicShipment(row);
    throw new HttpError(409, 'SHIPMENT_PENDING', 'Đơn đang gửi hoặc cần đối soát. Không tạo mã đơn mới để gửi lại.');
  }
  return {
    create: async (value) => submit(validateOrder(value)),
    createRaw: async (value) => { const rawPayload = validateRawCreate(value); return submit({ referenceId: rawPayload.client_order_code, rawPayload }); },
    get(id) {
      const row = store.get(id);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy đơn');
      return publicShipment(row);
    },
    async reconcile(id) {
      if (active.has(id)) throw new HttpError(409, 'SHIPMENT_PENDING', 'Đơn vẫn đang gửi; chờ kết quả trước khi đối soát');
      const row = store.get(id);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy đơn');
      if (row.provider !== identity || !provider.lookup) throw new HttpError(409, 'PROVIDER_MISMATCH', 'Không thể đối soát với cấu hình hiện tại');
      const response = await provider.lookup(id);
      if (!response?.data?.order_code) throw new HttpError(502, 'GHN_UNCERTAIN', 'GHN chưa trả mã vận đơn; giữ nguyên trạng thái');
      store.finish(id, 'CREATED', response.data.order_code);
      return { ...publicShipment(store.get(id)), ghn: response.data };
    },
  };
}

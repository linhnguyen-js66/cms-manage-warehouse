import { HttpError } from './errors.js';
import { invalid, requireText, requireInt, requireCodes, validateRawCreate } from './ghn-validation.js';
import { orderStatuses, reasonCodes } from './ghn-reference.js';

const order = '/shiip/public-api/v2/shipping-order/';
const master = '/shiip/public-api/master-data/';
export const routes = [
  ['POST', '/api/ghn/orders/update', order + 'update', ['order_code']],
  ['POST', '/api/ghn/orders/update-cod', order + 'updateCOD', ['order_code', 'cod_amount']],
  ['POST', '/api/ghn/orders/cancel', '/shiip/public-api/v2/switch-status/cancel', ['order_codes']],
  ['POST', '/api/ghn/orders/return', '/shiip/public-api/v2/switch-status/return', ['order_codes']],
  ['POST', '/api/ghn/orders/redeliver', '/shiip/public-api/v2/switch-status/storing', ['order_codes']],
  ['POST', '/api/ghn/orders/print', '/shiip/public-api/v2/a5/gen-token', ['order_codes']],
  ['GET', '/api/ghn/orders/detail', order + 'detail', ['order_code']],
  ['GET', '/api/ghn/orders/by-client-code', order + 'detail-by-client-code', ['client_order_code']],
  ['POST', '/api/ghn/orders/preview', order + 'preview', []],
  ['POST', '/api/ghn/orders/leadtime', order + 'leadtime', ['to_district_id', 'to_ward_code']],
  ['POST', '/api/ghn/orders/calculate-fee', order + 'fee', ['to_district_id', 'to_ward_code', 'weight', 'service_type_id']],
  ['GET', '/api/ghn/orders/fees', order + 'soc', ['order_code']],
  ['GET', '/api/ghn/master/provinces', master + 'province', []],
  ['GET', '/api/ghn/master/districts', master + 'district', ['province_id']],
  ['GET', '/api/ghn/master/wards', master + 'ward', ['district_id']],
  ['GET', '/api/ghn/master/provinces-new', '/shiip/public-api/v3/master-data/province/all', [], ['offset', 'limit']],
  ['GET', '/api/ghn/master/wards-new', '/shiip/public-api/v3/master-data/ward/all-by-province-id', ['province_id'], ['offset', 'limit']],
  ['GET', '/api/ghn/master/stations', '/shiip/public-api/v2/station/get', ['district_id'], ['ward_code', 'offset', 'limit']],
  ['POST', '/api/ghn/master/services', order + 'available-services', ['from_district', 'to_district']],
  ['GET', '/api/ghn/master/pick-shifts', '/shiip/public-api/v2/shift/date', []],
  ['GET', '/api/ghn/shops', '/shiip/public-api/v2/shop/all', [], ['offset', 'limit', 'client_phone']],
];

export function createGhnGateway(client) {
  return {
    async handle(method, path, input) {
      if (method === 'GET' && path === '/api/ghn/master/statuses') return { data: orderStatuses };
      if (method === 'GET' && path === '/api/ghn/master/reasons') return { data: reasonCodes, documentation: 'https://developer.ghn.vn/vi/docs/master-data/reason-code' };
      const route = routes.find((entry) => entry[0] === method && entry[1] === path);
      if (!route) throw new HttpError(404, 'NOT_FOUND', 'API GHN không tồn tại');
      const [, , upstream, required, optional = []] = route;
      if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Payload phải là object');
      let payload;
      if (method === 'GET') {
        payload = Object.fromEntries([...required, ...optional].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
      } else payload = structuredClone(input);
      for (const key of required) if (payload[key] === undefined || payload[key] === null || payload[key] === '') invalid(`Thiếu ${key}`);
      for (const key of ['order_code', 'client_order_code', 'to_ward_code', 'from_ward_code']) if (payload[key] !== undefined) requireText(payload[key], key, 100);
      for (const key of ['to_district_id', 'from_district_id', 'from_district', 'to_district', 'province_id', 'district_id']) {
        if (payload[key] !== undefined) { payload[key] = Number(payload[key]); requireInt(payload[key], key, 1); }
      }
      for (const key of ['offset', 'limit']) if (payload[key] !== undefined) { payload[key] = Number(payload[key]); requireInt(payload[key], key, 0, key === 'limit' ? 200 : 1000000); }
      if (payload.order_codes !== undefined) requireCodes(payload.order_codes, path.endsWith('/print') ? 10000 : 1000);
      if (path.endsWith('/update-cod')) {
        requireInt(payload.cod_amount, 'cod_amount', 0, 5000000);
        payload = { order_code: payload.order_code, cod_amount: payload.cod_amount };
      }
      if (path.endsWith('/update') && payload.cod_amount !== undefined) {
        requireInt(payload.cod_amount, 'cod_amount', 0, 50000000);
        requireText(payload.otp, 'otp', 20);
      }
      if (path.endsWith('/preview')) {
        // Preview does not require a client reference; inject a local validation-only one.
        const validated = validateRawCreate({ ...payload, client_order_code: payload.client_order_code || 'PREVIEW-ONLY' });
        payload = validated;
        if (!input.client_order_code) delete payload.client_order_code;
      }
      if (path.endsWith('/services')) payload.shop_id = client.shopId;
      if (path.endsWith('/calculate-fee') || path.endsWith('/leadtime')) {
        if (payload.weight !== undefined) requireInt(payload.weight, 'weight', 1, 50000);
        if (payload.service_type_id !== undefined && ![2, 5].includes(payload.service_type_id)) invalid('service_type_id phải là 2 hoặc 5');
      }
      const response = await client.request(upstream, { method, payload, requireShop: !path.endsWith('/pick-shifts') && path !== '/api/ghn/shops' });
      if (path.endsWith('/print')) {
        if (!response?.data?.token) throw new HttpError(502, 'GHN_UNCERTAIN', 'GHN không trả token in');
        const token = encodeURIComponent(response.data.token);
        return { ...response, printUrls: Object.fromEntries(['A5', '80x80', '52x70'].map((size) => [size, `${client.baseURL}/a5/public-api/print${size}?token=${token}`])) };
      }
      // Keep per-order result:false; HTTP 200 does not mean every action succeeded.
      return response;
    },
  };
}

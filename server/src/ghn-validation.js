import { HttpError } from './errors.js';
export function invalid(message) { throw new HttpError(400, 'INVALID_GHN_PAYLOAD', message); }
export function requireText(value, key, max = 1024) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid(`${key} không hợp lệ`);
}
export function requireInt(value, key, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${key} không hợp lệ`);
}
export function requireCodes(codes, max = 1000) {
  if (!Array.isArray(codes) || !codes.length || codes.length > max) invalid(`Cần 1–${max} order_codes`);
  for (const code of codes) requireText(code, 'order_code', 50);
}
export function validateRawCreate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Payload phải là object');
  requireText(value.client_order_code, 'client_order_code', 50);
  if (!/^[A-Za-z0-9_-]{8,50}$/.test(value.client_order_code)) invalid('client_order_code cần 8–50 ký tự chữ/số/_/-');
  for (const key of ['to_name', 'to_phone', 'to_address', 'to_ward_name', 'to_province_name']) requireText(value[key], key);
  if (value.is_new_to_address !== true) requireText(value.to_district_name, 'to_district_name');
  for (const key of ['is_new_to_address', 'is_new_from_address', 'is_new_return_address']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') invalid(`${key} phải là boolean`);
  }
  requireInt(value.weight, 'weight', 1, 50000);
  for (const key of ['length', 'width', 'height']) requireInt(value[key], key, 1, 200);
  if (![2, 5].includes(value.service_type_id)) invalid('service_type_id phải là 2 hoặc 5');
  if (value.service_type_id === 2 && value.weight >= 20000) invalid('Từ 20kg cần service_type_id=5');
  if (![1, 2].includes(value.payment_type_id)) invalid('payment_type_id phải là 1 hoặc 2');
  if (!['KHONGCHOXEMHANG', 'CHOXEMHANGKHONGTHU', 'CHOTHUHANG'].includes(value.required_note)) invalid('required_note không hợp lệ');
  if (value.cod_amount !== undefined) requireInt(value.cod_amount, 'cod_amount', 0, 50000000);
  if (value.insurance_value !== undefined) requireInt(value.insurance_value, 'insurance_value', 0, 5000000);
  if (value.items !== undefined) {
    if (!Array.isArray(value.items) || !value.items.length || value.items.length > 100) invalid('items cần 1–100 phần tử');
    for (const item of value.items) {
      requireText(item?.name, 'item.name', 512); requireInt(item?.quantity, 'item.quantity', 1, 1000);
      if (item.price !== undefined) requireInt(item.price, 'item.price', 0, 100000000);
      if (value.service_type_id === 5) {
        requireInt(item.weight, 'item.weight', 1, 50000);
        for (const key of ['length', 'width', 'height']) requireInt(item[key], `item.${key}`, 1, 200);
      }
    }
  } else {
    requireText(value.content, 'content', 2000);
    if (value.service_type_id === 5) invalid('Dịch vụ 5 cần items');
  }
  return structuredClone(value);
}

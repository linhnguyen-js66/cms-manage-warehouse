import { HttpError } from '../errors.js';

export function toGhnPayload(order) {
  const payload = {
    client_order_code: order.referenceId,
    to_name: order.recipient.name, to_phone: order.recipient.phone,
    to_address: order.recipient.address.line1,
    to_province_name: order.recipient.address.province,
    to_ward_name: order.recipient.address.ward,
    is_new_to_address: order.recipient.address.isNewAddress,
    payment_type_id: order.shippingFeePayer === 'sender' ? 1 : 2,
    service_type_id: order.ghn.serviceTypeId,
    required_note: order.ghn.requiredNote,
    cod_amount: order.codAmount,
    insurance_value: order.ghn.insuranceValue,
    weight: order.parcel.weightGrams,
    length: order.parcel.lengthCm, width: order.parcel.widthCm, height: order.parcel.heightCm,
    note: order.note,
    items: order.items.map((item) => ({
      code: item.sku, name: item.name, quantity: item.quantity, price: item.unitPrice,
      ...(item.parcel ? { weight: item.parcel.weightGrams, length: item.parcel.lengthCm, width: item.parcel.widthCm, height: item.parcel.heightCm } : {}),
    })),
  };
  if (!payload.is_new_to_address) payload.to_district_name = order.recipient.address.district;
  if (order.sender) {
    Object.assign(payload, {
      from_name: order.sender.name, from_phone: order.sender.phone,
      from_address: order.sender.address.line1,
      from_province_name: order.sender.address.province,
      from_ward_name: order.sender.address.ward,
      is_new_from_address: order.sender.address.isNewAddress,
    });
    if (!order.sender.address.isNewAddress) payload.from_district_name = order.sender.address.district;
  }
  if (order.ghn.coupon) payload.coupon = order.ghn.coupon;
  if (order.ghn.pickShift.length) payload.pick_shift = order.ghn.pickShift;
  return payload;
}
export function createGhnProvider(client) {
  return {
    name: 'ghn',
    identity: `ghn:${client.environment}:${client.shopId}`,
    assertReady() { client.assertReady(); },
    async createShipment(order) {
      const result = await client.request('/shiip/public-api/v2/shipping-order/create', { payload: order.rawPayload || toGhnPayload(order) });
      if (!result?.data?.order_code) throw new HttpError(502, 'GHN_UNCERTAIN', 'GHN chưa trả mã vận đơn');
      return { trackingNumber: result.data.order_code };
    },
    async lookup(referenceId) {
      return client.request('/shiip/public-api/v2/shipping-order/detail-by-client-code', { method: 'GET', payload: { client_order_code: referenceId } });
    },
  };
}

import { HttpError } from './errors.js';

function invalid(message) { throw new HttpError(400, 'INVALID_ORDER', message); }
function text(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    invalid(`${label} không hợp lệ`);
  }
  return value.trim();
}
function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${label} không hợp lệ`);
  return value;
}
function phone(value, label) {
  const result = text(value, label, 20).replace(/[\s.-]/g, '');
  if (!/^(?:0\d{9}|\+84\d{9})$/.test(result)) invalid(`${label} phải là số điện thoại Việt Nam`);
  return result;
}
function contact(value, label) {
  return {
    name: text(value?.name, `${label}: tên`, 100),
    phone: phone(value?.phone, `${label}: điện thoại`),
    address: {
      line1: text(value?.address?.line1, `${label}: địa chỉ`, 300),
      province: text(value?.address?.province, `${label}: tỉnh/thành`, 100),
      ward: text(value?.address?.ward, `${label}: phường/xã`, 100),
      isNewAddress: value?.address?.isNewAddress !== false,
      district: typeof value?.address?.district === 'string' ? value.address.district.trim() : '',
    },
  };
}
export function validateOrder(value) {
  const referenceId = text(value?.referenceId, 'Mã đơn', 50);
  if (!/^[A-Za-z0-9_-]{8,50}$/.test(referenceId)) invalid('Mã đơn phải có 8–50 ký tự chữ, số, _ hoặc -');
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100) invalid('Cần 1–100 sản phẩm');
  const items = value.items.map((item) => ({
    sku: text(item?.sku, 'SKU', 100),
    name: text(item?.name, 'Tên sản phẩm'),
    quantity: integer(item?.quantity, 'Số lượng', 1, 1000),
    unitPrice: integer(item?.unitPrice, 'Đơn giá (VND)', 0, 100000000),
    ...(item.parcel ? { parcel: {
      weightGrams: integer(item.parcel.weightGrams, 'Khối lượng sản phẩm', 1, 50000),
      lengthCm: integer(item.parcel.lengthCm, 'Dài sản phẩm', 1, 200),
      widthCm: integer(item.parcel.widthCm, 'Rộng sản phẩm', 1, 200),
      heightCm: integer(item.parcel.heightCm, 'Cao sản phẩm', 1, 200),
    } } : {}),
  }));
  const goodsValue = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!Number.isSafeInteger(goodsValue) || goodsValue > 100000000) invalid('Tổng tiền hàng vượt giới hạn');
  if (!['sender', 'recipient'].includes(value?.shippingFeePayer)) invalid('Người trả phí ship không hợp lệ');
  const serviceTypeId = value?.ghn?.serviceTypeId ?? (value?.parcel?.weightGrams >= 20000 ? 5 : 2);
  if (![2, 5].includes(serviceTypeId)) invalid('Loại dịch vụ phải là 2 hoặc 5');
  if (serviceTypeId === 2 && value?.parcel?.weightGrams >= 20000) invalid('Từ 20 kg phải chọn dịch vụ 5');
  if (serviceTypeId === 5 && items.some((item) => !item.parcel)) invalid('Dịch vụ 5 cần kích thước và khối lượng từng sản phẩm/kiện');
  const requiredNote = value?.ghn?.requiredNote ?? 'KHONGCHOXEMHANG';
  if (!['KHONGCHOXEMHANG', 'CHOXEMHANGKHONGTHU', 'CHOTHUHANG'].includes(requiredNote)) invalid('requiredNote không hợp lệ');
  const pickShift = value?.ghn?.pickShift ?? [];
  if (!Array.isArray(pickShift) || pickShift.length > 20) invalid('Ca lấy hàng không hợp lệ');
  const recipient = contact(value.recipient, 'Người nhận');
  const sender = value.sender ? contact(value.sender, 'Người gửi') : undefined;
  for (const person of [recipient, sender].filter(Boolean)) {
    if (!person.address.isNewAddress && !person.address.district) invalid('Địa chỉ hệ cũ cần quận/huyện');
  }
  return {
    referenceId,
    ghn: {
      serviceTypeId, requiredNote,
      insuranceValue: integer(value?.ghn?.insuranceValue ?? 0, 'Giá trị khai giá', 0, 5000000),
      coupon: typeof value?.ghn?.coupon === 'string' ? value.ghn.coupon.trim().slice(0, 100) : '',
      pickShift: pickShift.map((id) => integer(id, 'Ca lấy hàng', 1, 100000)),
    },
    sender, recipient,
    items,
    goodsValue,
    codAmount: integer(value.codAmount, 'COD (VND)', 0, 50000000),
    shippingFeePayer: value.shippingFeePayer,
    parcel: {
      weightGrams: integer(value?.parcel?.weightGrams, 'Khối lượng (gram)', 1, 50000),
      lengthCm: integer(value?.parcel?.lengthCm, 'Chiều dài (cm)', 1, 200),
      widthCm: integer(value?.parcel?.widthCm, 'Chiều rộng (cm)', 1, 200),
      heightCm: integer(value?.parcel?.heightCm, 'Chiều cao (cm)', 1, 200),
    },
    note: typeof value.note === 'string' ? value.note.trim().slice(0, 500) : '',
  };
}

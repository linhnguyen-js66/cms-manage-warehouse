// Public API URL only. GHN_TOKEN and GHN_SHOP_ID stay in the server .env.
export type GhnProduct = {
  id: string;
  name: string;
  sku?: string;
  variantId?: string;
  variantIndex?: number;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
export type ShippingAddress = {
  provinceId?: number;
  wardId?: number;
  province: string;
  ward: string;
  isNewAddress: true;
};
export type GhnRawOrder = {
  client_order_code: string;
  to_name: string;
  to_phone: string;
  to_address: string;
  to_province_name: string;
  to_ward_name: string;
  is_new_to_address: true;
  from_name: string;
  from_phone: string;
  from_address: string;
  from_province_name: string;
  from_ward_name: string;
  is_new_from_address: true;
  payment_type_id: 1;
  service_type_id: 2;
  required_note: string;
  cod_amount: number;
  insurance_value: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  note: string;
  items: { name: string; code?: string; quantity: number; price: number }[];
};
export type GhnSync = {
  referenceId: string;
  state:
    | "READY"
    | "AWAITING_PAYMENT"
    | "SUBMITTING"
    | "UNKNOWN"
    | "REJECTED"
    | "CREATED";
  request: GhnRawOrder;
  estimatedFee?: number;
  trackingNumber?: string;
  simulated?: boolean;
  environment?: string | null;
  syncedAt?: string;
  error?: string;
};
export type GhnOrderInput = {
  customerName: string;
  customerPhone: string;
  addressReceive: string;
  addressShowroom: string;
  senderName: string;
  senderPhone: string;
  recipientAddress: ShippingAddress;
  senderAddress: ShippingAddress;
  products: GhnProduct[];
  weight: number;
  length: number;
  width: number;
  height: number;
  typePayment: string;
  statusPayment: string;
  totalAmount: number;
  requiredNote?: string;
  insuranceValue?: number;
  shippingNote?: string;
};

function text(value: unknown, label: string, max = 1024): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label} không hợp lệ`);
  return value.trim();
}
function optionalText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > max)
    throw new Error(`${label} không hợp lệ`);
  return value.trim();
}
export function createGhnReferenceId(): string {
  // Generate once for a new Firebase order and persist before dispatch.
  // Reuse that saved reference when reconciling or retrying the same order.
  return `GHN-${globalThis.crypto.randomUUID()}`;
}
function integer(
  value: number,
  label: string,
  min: number,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label} không hợp lệ`);
  return value;
}
export function normalizePhone(value: unknown): string {
  const phone = text(value, "Số điện thoại", 30)
    .replace(/[\s.()-]/g, "")
    .replace(/^\+84/, "0");
  if (!/^0\d{9}$/.test(phone))
    throw new Error("Số điện thoại Việt Nam cần 10 số, bắt đầu bằng 0");
  return phone;
}
export function cartRowKey(
  item: Pick<GhnProduct, "id" | "variantId" | "variantIndex">,
): string {
  return JSON.stringify([item.id, item.variantId ?? item.variantIndex ?? 0]);
}
export function normalizeCartProducts<T extends GhnProduct>(
  products: T[],
): T[] {
  if (!products.length || products.length > 100)
    throw new Error("Đơn cần 1–100 sản phẩm");
  const keys = new Set<string>();
  return products.map((item) => {
    const key = cartRowKey(item);
    if (keys.has(key)) throw new Error("Biến thể sản phẩm bị trùng trong đơn");
    keys.add(key);
    const quantity = integer(item.quantity, "Số lượng", 1, 1000);
    const unitPrice = integer(item.unitPrice, "Đơn giá", 0, 100000000);
    const lineTotal = integer(unitPrice * quantity, "Thành tiền", 0, 100000000);
    return {
      ...item,
      name: text(item.name, "Tên sản phẩm", 512),
      quantity,
      unitPrice,
      lineTotal,
    };
  });
}
export function toGhnOrder(
  order: GhnOrderInput,
  referenceId: string,
): GhnRawOrder {
  if (!/^[A-Za-z0-9_-]{8,50}$/.test(referenceId))
    throw new Error("Mã CMS cho GHN cần 8–50 ký tự chữ/số/_/-");
  const products = normalizeCartProducts(order.products);
  const weightGrams = integer(
    Math.round(Number(order.weight) * 1000),
    "Khối lượng (gram)",
    1,
    19999,
  );
  if (!Number.isFinite(order.weight) || order.weight <= 0 || order.weight >= 20)
    throw new Error(
      "Form này hỗ trợ kiện dưới 20kg; kiện nặng cần cấu hình dịch vụ 5 và kích thước từng sản phẩm",
    );
  if (!["COD", "BANK_TRANSFER"].includes(order.typePayment))
    throw new Error("Hình thức thanh toán không hợp lệ");
  if (!["PENDING", "PAID"].includes(order.statusPayment))
    throw new Error("Trạng thái thanh toán không hợp lệ");
  const requiredNote = order.requiredNote || "KHONGCHOXEMHANG";
  if (
    !["KHONGCHOXEMHANG", "CHOXEMHANGKHONGTHU", "CHOTHUHANG"].includes(
      requiredNote,
    )
  )
    throw new Error("Quy định xem hàng không hợp lệ");
  return {
    client_order_code: referenceId,
    to_name: text(order.customerName, "Tên người nhận"),
    to_phone: normalizePhone(order.customerPhone),
    to_address: text(order.addressReceive, "Địa chỉ nhận"),
    to_province_name: text(order.recipientAddress?.province, "Tỉnh nhận"),
    to_ward_name: text(order.recipientAddress?.ward, "Phường/xã nhận"),
    is_new_to_address: true,
    from_name: text(order.senderName, "Tên người gửi"),
    from_phone: normalizePhone(order.senderPhone),
    from_address: text(order.addressShowroom, "Địa chỉ lấy hàng"),
    from_province_name: text(order.senderAddress?.province, "Tỉnh gửi"),
    from_ward_name: text(order.senderAddress?.ward, "Phường/xã gửi"),
    is_new_from_address: true,
    // GHN charges the shop. Any shipping charged to the customer is already in totalAmount.
    payment_type_id: 1,
    service_type_id: 2,
    required_note: requiredNote,
    cod_amount:
      order.typePayment === "COD" && order.statusPayment !== "PAID"
        ? integer(order.totalAmount, "Tiền thu hộ COD", 0, 50000000)
        : 0,
    insurance_value: integer(
      order.insuranceValue ?? 0,
      "Giá trị khai giá",
      0,
      5000000,
    ),
    weight: weightGrams,
    length: integer(order.length, "Dài (cm)", 1, 200),
    width: integer(order.width, "Rộng (cm)", 1, 200),
    height: integer(order.height, "Cao (cm)", 1, 200),
    note: optionalText(order.shippingNote, "Ghi chú giao hàng", 5000),
    items: products.map((item) => ({
      name: `${item.name}${item.variantLabel ? ` - ${item.variantLabel}` : ""}`.slice(
        0,
        512,
      ),
      ...(item.sku?.trim() ? { code: item.sku.trim().slice(0, 100) } : {}),
      quantity: item.quantity,
      price: item.unitPrice,
    })),
  };
}
// Omit undefined in plain objects; keep Firestore Timestamp/Date/sentinel instances intact.
export function firestoreSafe<T>(value: T): T {
  if (Array.isArray(value))
    return value.map((item) => {
      if (item === undefined)
        throw new Error("Dữ liệu mảng Firebase có undefined");
      return firestoreSafe(item);
    }) as T;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, firestoreSafe(v)]),
    ) as T;
  }
  return value;
}
// GHN's new administrative catalog uses _id/name, not ProvinceID/WardCode.
export type GhnLocationOption = {
  value: number;
  label: string;
  searchText: string;
  parentId: number;
};
export function normalizeLocationSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
export function ghnLocationOptions(
  data: unknown,
  kind: "province" | "ward",
  parentId?: number,
): GhnLocationOption[] {
  if (data === null && kind === "ward") return [];
  if (!Array.isArray(data))
    throw new Error("Danh mục địa chỉ GHN không đúng định dạng");
  const seen = new Set<number>();
  return data
    .flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        item.status !== 1 ||
        item.type !== kind
      )
        return [];
      if (
        !Number.isSafeInteger(item._id) ||
        item._id <= 0 ||
        typeof item.name !== "string" ||
        !item.name.trim()
      )
        throw new Error("Danh mục GHN thiếu mã hoặc tên địa chỉ");
      if (!Number.isSafeInteger(item.parent_id) || item.parent_id <= 0)
        throw new Error("Danh mục GHN thiếu mã địa chỉ cha");
      if (kind === "ward" && item.parent_id !== parentId) return [];
      if (seen.has(item._id)) return [];
      seen.add(item._id);
      const names = [
        item.name,
        ...(Array.isArray(item.extension_names)
          ? item.extension_names.filter(
              (name: unknown) => typeof name === "string",
            )
          : []),
      ];
      return [
        {
          value: item._id,
          label: item.name,
          parentId: item.parent_id,
          searchText: names.map(normalizeLocationSearch).join(" "),
        },
      ];
    })
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}
export function resolveGhnAddress(
  provinceId: unknown,
  wardId: unknown,
  provinces: GhnLocationOption[],
  wards: GhnLocationOption[],
): ShippingAddress {
  const province = provinces.find((item) => item.value === provinceId);
  const ward = wards.find(
    (item) => item.value === wardId && item.parentId === province?.value,
  );
  if (!province || !ward)
    throw new Error("Chọn tỉnh/thành và phường/xã hợp lệ từ danh mục GHN");
  return {
    provinceId: province.value,
    province: province.label,
    wardId: ward.value,
    ward: ward.label,
    isNewAddress: true,
  };
}

export type GhnShipment = {
  referenceId: string;
  provider: string;
  status: "SUBMITTING" | "UNKNOWN" | "REJECTED" | "CREATED";
  trackingNumber: string | null;
  simulated: boolean;
  environment: string | null;
  createdAt: string;
  updatedAt: string;
};
export type GhnResponse<T> = { code: number; message?: string; data: T };
export type GhnBatchResult = {
  order_code: string;
  result: boolean;
  message?: string;
};
export type GhnPreview = {
  order_code?: string;
  total_fee: number;
  expected_delivery_time?: string;
  fee?: Record<string, number>;
};
export type GhnOrderDetail = {
  order_code: string;
  client_order_code?: string;
  status?: string;
  [key: string]: unknown;
};
export class ShippingApiError extends Error {
  code: string;
  status: number;
  upstreamCode: string | null;
  constructor(
    message: string,
    code: string,
    status: number,
    upstreamCode: string | null = null,
  ) {
    super(message);
    this.name = "ShippingApiError";
    this.code = code;
    this.status = status;
    this.upstreamCode = upstreamCode;
  }
}

// baseURL is the CMS server URL, e.g. http://localhost:3001, never the GHN gateway.
// An empty URL uses the current origin (when /api is proxied to the server).
export function createGhnApi(baseURL: string) {
  const base = baseURL.trim().replace(/\/+$/, "");
  if (base) {
    const url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("URL server GHN không hợp lệ");
  }
  async function request<T>(
    path: string,
    method = "GET",
    payload?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new ShippingApiError(
        "Mất kết nối server; tra cứu cùng mã CMS trước khi gửi lại",
        "NETWORK_UNKNOWN",
        0,
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ShippingApiError(
        "Server trả dữ liệu không đọc được; cần tra cứu lại",
        "NETWORK_UNKNOWN",
        response.status,
      );
    }
    const object =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : null;
    if (!response.ok) {
      const error =
        object?.error && typeof object.error === "object"
          ? (object.error as Record<string, unknown>)
          : null;
      throw new ShippingApiError(
        typeof error?.message === "string"
          ? error.message
          : "Server từ chối yêu cầu",
        typeof error?.code === "string" ? error.code : "API_ERROR",
        response.status,
        typeof error?.upstreamCode === "string" ? error.upstreamCode : null,
      );
    }
    if (!object || Array.isArray(body))
      throw new ShippingApiError(
        "Response server không đúng định dạng; cần tra cứu lại",
        "NETWORK_UNKNOWN",
        response.status,
      );
    return body as T;
  }
  // GHN gateway endpoints keep {code,message,data}; create/get/reconcile return
  // the CMS shipment record. Do not read data.order_code from the create response.
  async function gateway<T>(
    path: string,
    method = "GET",
    payload?: unknown,
  ): Promise<GhnResponse<T>> {
    const result = await request<GhnResponse<T>>(path, method, payload);
    if (result.code !== 200 || !("data" in result))
      throw new ShippingApiError(
        "Response GHN không đúng định dạng",
        "GHN_UNCERTAIN",
        502,
      );
    return result;
  }
  async function shipment(
    path: string,
    referenceId: string,
    method = "GET",
    payload?: unknown,
  ): Promise<GhnShipment> {
    const result = await request<GhnShipment>(path, method, payload);
    if (
      result.referenceId !== referenceId ||
      !["SUBMITTING", "UNKNOWN", "REJECTED", "CREATED"].includes(
        result.status,
      ) ||
      (result.status === "CREATED" &&
        (typeof result.trackingNumber !== "string" ||
          !result.trackingNumber.trim()))
    )
      throw new ShippingApiError(
        "Kết quả tạo/tra cứu đơn không hợp lệ; đối soát cùng mã CMS",
        "NETWORK_UNKNOWN",
        502,
      );
    return result;
  }
  function referencePath(id: string): string {
    if (!/^[A-Za-z0-9_-]{8,50}$/.test(id))
      throw new Error("Mã CMS không hợp lệ");
    return `/api/shipments/${encodeURIComponent(id)}`;
  }
  async function loadLocations(
    kind: "province" | "ward",
    provinceId?: number,
  ): Promise<GhnLocationOption[]> {
    if (
      kind === "ward" &&
      (!Number.isSafeInteger(provinceId) || Number(provinceId) <= 0)
    )
      throw new Error("Mã tỉnh GHN không hợp lệ");
    const entries: unknown[] = [];
    const pages = new Set<string>();
    for (let offset = 0; offset < 20000; offset += 200) {
      const query = new URLSearchParams({
        offset: String(offset),
        limit: "200",
      });
      if (kind === "ward") query.set("province_id", String(provinceId));
      const response = await gateway<unknown>(
        `/api/ghn/master/${kind === "province" ? "provinces-new" : "wards-new"}?${query}`,
      );
      if (response.data === null && kind === "ward")
        return ghnLocationOptions(entries, kind, provinceId);
      if (!Array.isArray(response.data))
        throw new Error("Danh mục địa chỉ GHN không đúng định dạng");
      const pageKey = JSON.stringify(response.data.map((item) => item?._id));
      if (response.data.length && pages.has(pageKey))
        throw new Error("GHN trả lặp trang địa chỉ; hãy tải lại");
      pages.add(pageKey);
      entries.push(...response.data);
      if (response.data.length < 200)
        return ghnLocationOptions(entries, kind, provinceId);
    }
    throw new Error("Không tải hết được danh mục GHN; hãy thử lại");
  }
  return {
    health: () => request<{ ok: boolean }>("/health"),
    login: (password: string) =>
      request<{ ok: boolean }>("/api/auth/login", "POST", { password }),
    logout: () => request<{ ok: boolean }>("/api/auth/logout", "POST", {}),
    provinces: () => loadLocations("province"),
    wards: (provinceId: number) => loadLocations("ward", provinceId),
    create: (payload: GhnRawOrder) => {
      referencePath(payload.client_order_code);
      return shipment(
        "/api/ghn/orders/create",
        payload.client_order_code,
        "POST",
        payload,
      );
    },
    get: (id: string) => shipment(referencePath(id), id),
    reconcile: (id: string) =>
      shipment(`${referencePath(id)}/reconcile`, id, "POST", {}),
    preview: async (payload: GhnRawOrder) => {
      const result = await gateway<GhnPreview>(
        "/api/ghn/orders/preview",
        "POST",
        payload,
      );
      if (
        !result.data ||
        !Number.isSafeInteger(result.data.total_fee) ||
        result.data.total_fee < 0
      )
        throw new ShippingApiError(
          "GHN không trả phí vận chuyển hợp lệ",
          "GHN_UNCERTAIN",
          502,
        );
      return result;
    },
    cancel: (orderCode: string) =>
      gateway<GhnBatchResult[]>("/api/ghn/orders/cancel", "POST", {
        order_codes: [text(orderCode, "Mã vận đơn", 50)],
        reason_code: "GHN-CANCEL-OTHER",
      }),
    detail: (orderCode: string) =>
      gateway<GhnOrderDetail>(
        `/api/ghn/orders/detail?${new URLSearchParams({ order_code: text(orderCode, "Mã vận đơn", 50) })}`,
      ),
    byClientCode: (id: string) =>
      gateway<GhnOrderDetail>(
        `/api/ghn/orders/by-client-code?${new URLSearchParams({ client_order_code: text(id, "Mã CMS", 50) })}`,
      ),
    update: (orderCode: string, changes: Record<string, unknown>) =>
      gateway<null>("/api/ghn/orders/update", "POST", {
        ...changes,
        order_code: text(orderCode, "Mã vận đơn", 50),
      }),
    updateCod: (orderCode: string, amount: number) =>
      gateway<null>("/api/ghn/orders/update-cod", "POST", {
        order_code: text(orderCode, "Mã vận đơn", 50),
        cod_amount: integer(amount, "COD cập nhật", 0, 5000000),
      }),
    returnOrder: (orderCode: string) =>
      gateway<GhnBatchResult[]>("/api/ghn/orders/return", "POST", {
        order_codes: [text(orderCode, "Mã vận đơn", 50)],
      }),
    redeliver: (orderCode: string) =>
      gateway<GhnBatchResult[]>("/api/ghn/orders/redeliver", "POST", {
        order_codes: [text(orderCode, "Mã vận đơn", 50)],
      }),
    print: (orderCodes: string[]) => {
      if (!orderCodes.length || orderCodes.length > 10000)
        throw new Error("In đơn cần 1–10.000 mã vận đơn");
      return request<
        GhnResponse<{ token: string }> & {
          printUrls: Record<"A5" | "80x80" | "52x70", string>;
        }
      >("/api/ghn/orders/print", "POST", {
        order_codes: orderCodes.map((code) => text(code, "Mã vận đơn", 50)),
      });
    },
    shops: (offset = 0, limit = 50) =>
      gateway<{ shops: Record<string, unknown>[]; last_offset?: number }>(
        `/api/ghn/shops?${new URLSearchParams({ offset: String(integer(offset, "Offset", 0, 1000000)), limit: String(integer(limit, "Limit", 0, 200)) })}`,
      ),
    pickShifts: () =>
      gateway<
        { id: number; title: string; from_time: number; to_time: number }[]
      >("/api/ghn/master/pick-shifts"),
  };
}

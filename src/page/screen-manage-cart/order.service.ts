import dayjs from "dayjs";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase";
import type {
  AppUser,
  CreateOrderPayload,
  OrderDoc,
  PromotionDoc,
  ProductDoc,
  SelectedOrderProduct,
  ShippingProviderId,
  UserLevel,
  PaymentDoc,
  ProductSaleLogDoc,
} from "./order.types";

export const CURRENT_ADMIN_ID = "staff_001";

export const SHIPPING_PROVIDERS: Array<{
  id: ShippingProviderId;
  label: string;
  feePerKg: number;
}> = [
  { id: "SPX", label: "ShopeeExpress", feePerKg: 15000 },
  { id: "JNT", label: "J&T", feePerKg: 30000 },
];

export const SHOWROOM_OPTIONS = [
  {
    value: "NT-HN01-OCP-1",
    label: "P3 Pavillon Premium, Vinhomes Ocean Park, Đa Tốn, Gia Lâm, Hà Nội",
    address: "P3 Pavillon Premium, Vinhomes Ocean Park, Đa Tốn, Gia Lâm, Hà Nội",
  },
];

export const ORDER_STATUS_TABS = [
  { key: "PENDING_APPROVAL", label: "Chờ phê duyệt" },
  { key: "PENDING_SHIPPING", label: "Đang chờ vận chuyển" },
  { key: "CANCELLED", label: "Đã huỷ" },
  { key: "SUCCESS", label: "Thành công" },
] as const;

export const normalizeUserLevel = (level?: string): UserLevel => {
  if (level === "BTB") return "BTB";
  if (level === "CTV") return "CTV";
  return "BTC";
};

export const getPriceByUserType = (
  product: ProductDoc,
  typeUser: UserLevel,
  variantIndex = 0,
) => {
  const variant = getVariantByIndex(product, variantIndex);
  const prices = variant?.prices || {};

  if (typeUser === "BTB") return Number(prices.btb || 0);
  if (typeUser === "CTV") return Number(prices.ctv || 0);
  return Number(prices.btc || 0);
};

export const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN") + " ₫";

export const calcShipFee = (
  providerId?: ShippingProviderId,
  weight?: number,
) => {
  if (!providerId || !weight) return 0;
  const provider = SHIPPING_PROVIDERS.find((item) => item.id === providerId);
  if (!provider) return 0;
  return Math.ceil(Number(weight)) * provider.feePerKg;
};

export const sortByCreatedDesc = <T extends { createdAt?: string }>(
  items: T[],
) => {
  return [...items].sort(
    (a, b) =>
      dayjs(b.createdAt || 0).valueOf() - dayjs(a.createdAt || 0).valueOf(),
  );
};

export const subscribeOrders = (callback: (orders: OrderDoc[]) => void) => {
  const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as OrderDoc[];

    callback(sortByCreatedDesc(data));
  });
};

export const getInitialOrderReferences = async () => {
  const [userSnap, productSnap, promotionSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "Users"),
        where("isStaff", "==", false),
        where("status", "==", "ACTIVE"),
      ),
    ),
    getDocs(
      query(collection(db, "Products"), where("status", "==", "AVAILABLE")),
    ),
    getDocs(collection(db, "Promotions")),
  ]);

  const users = userSnap.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as AppUser[];

  const products = productSnap.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as ProductDoc[];

  const promotions = promotionSnap.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as PromotionDoc[];

  return { users, products, promotions };
};

export const findCustomerByPhone = (users: AppUser[], phoneNumber: string) => {
  return (
    users.find(
      (item) =>
        String(item.phoneNumber || "").trim() === String(phoneNumber).trim(),
    ) || null
  );
};

const getPromotionProduct = (promotion: PromotionDoc, productId: string) => {
  return promotion?.products?.find(
    (item: any) => item?.idProduct === productId,
  );
};

export const validatePromotion = ({
  promotion,
  productId,
  typeUser,
  quantity = 1,
}: {
  promotion: PromotionDoc;
  productId: string;
  typeUser: UserLevel;
  quantity?: number;
}) => {
  if (!promotion) return false;

  const now = dayjs();

  if (promotion.status !== "ONGOING") return false;
  if (promotion.scope !== "PRODUCT") return false;

  const promotionAny = promotion as any;

  if (promotionAny.startDate && dayjs(promotionAny.startDate).isValid()) {
    if (now.isBefore(dayjs(promotionAny.startDate))) return false;
  }

  if (promotionAny.endDate && dayjs(promotionAny.endDate).isValid()) {
    if (now.isAfter(dayjs(promotionAny.endDate))) return false;
  }

  const productInCampaign = getPromotionProduct(promotion, productId);
  if (!productInCampaign) return false;

  const usedAmount = Number(productInCampaign.usedAmount || 0);
  const totalAmount = Number(productInCampaign.totalAmount || 0);
  if (totalAmount > 0 && usedAmount >= totalAmount) return false;

  if (
    Array.isArray(promotionAny.applyForUserLevels) &&
    promotionAny.applyForUserLevels.length > 0
  ) {
    if (!promotionAny.applyForUserLevels.includes(typeUser)) return false;
  }

  if (productInCampaign.minQuantity) {
    if (quantity < Number(productInCampaign.minQuantity || 0)) return false;
  }

  return true;
};

export const getProductPromotion = (
  promotions: PromotionDoc[],
  productId: string,
  typeUser?: UserLevel,
  quantity = 1,
): PromotionDoc | undefined => {
  return promotions.find((promo) =>
    validatePromotion({
      promotion: promo,
      productId,
      typeUser: typeUser || "BTC",
      quantity,
    }),
  );
};

export const getDiscountedUnitPrice = (
  product: ProductDoc,
  typeUser: UserLevel,
  promotions: PromotionDoc[],
  selectedPromotion?: PromotionDoc | null,
  quantity = 1,
  variantIndex = 0,
) => {
  const basePrice = getPriceByUserType(product, typeUser, variantIndex);

  let campaign: PromotionDoc | undefined;

  if (
    selectedPromotion &&
    validatePromotion({
      promotion: selectedPromotion,
      productId: product.id,
      typeUser,
      quantity,
    })
  ) {
    campaign = selectedPromotion;
  }

  if (!campaign) {
    campaign = getProductPromotion(promotions, product.id, typeUser, quantity);
  }

  if (!campaign) return basePrice;

  const productCampaign = getPromotionProduct(campaign, product.id);
  if (!productCampaign) return basePrice;

  const salePrice =
    typeUser === "BTB"
      ? Number(productCampaign.priceBtb || 0)
      : typeUser === "CTV"
        ? Number(productCampaign.priceCtv || 0)
        : Number(productCampaign.priceBtc || 0);

  if (!salePrice) return basePrice;

  return Math.max(0, salePrice);
};

export const buildSelectedOrderProduct = (
  product: ProductDoc,
  typeUser: UserLevel,
  promotions: PromotionDoc[],
  selectedPromotion?: PromotionDoc | null,
  quantity = 1,
  variantIndex = 0,
): SelectedOrderProduct => {
  const variant = getVariantByIndex(product, variantIndex);
  const basePrice = getPriceByUserType(product, typeUser, variantIndex);
  const variantId = getVariantId(product.id, variantIndex);
  const variantLabel = getVariantLabel(variant);
  const variantAttributes = variant?.attributes || {};

  let campaign: PromotionDoc | undefined;

  if (
    selectedPromotion &&
    validatePromotion({
      promotion: selectedPromotion,
      productId: product.id,
      typeUser,
      quantity,
    })
  ) {
    campaign = selectedPromotion;
  }

  if (!campaign) {
    campaign = getProductPromotion(promotions, product.id, typeUser, quantity);
  }

  if (!campaign) {
    return {
      id: product.id,
      name: product.name || "",
      image: product.images?.[0] || "",
      category: product.category || "",
      variantId,
      variantIndex,
      variantLabel,
      variantAttributes,
      quantity,
      unitPrice: basePrice,
      lineTotal: basePrice * quantity,
      promotion: null,
    };
  }

  const productCampaign = getPromotionProduct(campaign, product.id);
  if (!productCampaign) {
    return {
      id: product.id,
      name: product.name || "",
      image: product.images?.[0] || "",
      category: product.category || "",
      variantId,
      variantIndex,
      variantLabel,
      variantAttributes,
      quantity,
      unitPrice: basePrice,
      lineTotal: basePrice * quantity,
      promotion: null,
    };
  }

  const salePrice =
    typeUser === "BTB"
      ? Number(productCampaign.priceBtb || 0)
      : typeUser === "CTV"
        ? Number(productCampaign.priceCtv || 0)
        : Number(productCampaign.priceBtc || 0);

  if (!salePrice) {
    return {
      id: product.id,
      name: product.name || "",
      image: product.images?.[0] || "",
      category: product.category || "",
      variantId,
      variantIndex,
      variantLabel,
      variantAttributes,
      quantity,
      unitPrice: basePrice,
      lineTotal: basePrice * quantity,
      promotion: null,
    };
  }

  const unitPrice = Math.max(0, salePrice);

  const discountValue =
    campaign.discountType === "percent"
      ? Math.round(((basePrice - unitPrice) / basePrice) * 100)
      : Math.max(0, basePrice - unitPrice);

  return {
    id: product.id,
    name: product.name || "",
    image: product.images?.[0] || "",
    category: product.category || "",
    variantId,
    variantIndex,
    variantLabel,
    variantAttributes,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    promotion: {
      campaignId: campaign.id || "",
      campaignName: campaign.name || "",
      discountType: campaign.discountType,
      discountValue,
    },
  };
};

const buildAnalyticsTime = (isoDate: string) => {
  const time = dayjs(isoDate);

  return {
    dateKey: time.format("YYYY-MM-DD"),
    monthKey: time.format("YYYY-MM"),
    hourOfDay: time.hour(),
    timeBucket: `${time.format("HH")}:00-${time.format("HH")}:59`,
    dayOfWeek: time.day(),
  };
};

export const createOrder = async (payload: CreateOrderPayload) => {
  const createdAt = payload.createdAt || dayjs().toISOString();
  const analyticsTime = buildAnalyticsTime(createdAt);

  const orderRef = doc(collection(db, "Orders"));
  const paymentRef = doc(collection(db, "Payments"));

  const orderId = orderRef.id;
  const paymentId = paymentRef.id;

  const batch = writeBatch(db);

  const safeProducts = payload.products.map((item) => ({
    id: item.id || "",
    name: item.name || "",
    image: item.image || "",
    category: item.category || "",
    unitPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    lineTotal: Number(item.lineTotal || 0),
    promotion: item.promotion
      ? {
          campaignId: item.promotion.campaignId || "",
          campaignName: item.promotion.campaignName || "",
          discountType: item.promotion.discountType,
          discountValue: Number(item.promotion.discountValue || 0),
        }
      : null,
  }));

  const orderDoc: OrderDoc = {
    id: orderId,
    ...payload,
    customerName: payload.customerName || "",
    customerPhone: payload.customerPhone || "",
    addressShowroom: payload.addressShowroom || "",
    addressReceive: payload.addressReceive || "",
    products: safeProducts,
    totalProductAmount: Number(payload.totalProductAmount || 0),
    shipFee: Number(payload.shipFee || 0),
    totalAmount: Number(payload.totalAmount || 0),
    weight: Number(payload.weight || 0),
    length: Number(payload.length || 0),
    width: Number(payload.width || 0),
    height: Number(payload.height || 0),
    createdAt,
    createdBy: payload.createdBy || CURRENT_ADMIN_ID,
    paymentId,
    ...analyticsTime,
  };

  const paymentDoc: PaymentDoc = {
    id: paymentId,
    orderId,
    idUser: payload.idUser || "",
    customerName: payload.customerName || "",
    customerPhone: payload.customerPhone || "",
    amount: Number(payload.totalAmount || 0),
    totalProductAmount: Number(payload.totalProductAmount || 0),
    shipFee: Number(payload.shipFee || 0),
    status: payload.statusPayment,
    typePayment: payload.typePayment,
    source: "ORDER",
    createdAt,
    paidAt: payload.statusPayment === "PAID" ? createdAt : null,
    dateKey: analyticsTime.dateKey,
    monthKey: analyticsTime.monthKey,
    hourOfDay: analyticsTime.hourOfDay,
    timeBucket: analyticsTime.timeBucket,
  };

  batch.set(orderRef, orderDoc);
  batch.set(paymentRef, paymentDoc);

  safeProducts.forEach((item) => {
    const saleLogRef = doc(collection(db, "ProductSalesLedger"));

    const saleLog: ProductSaleLogDoc = {
      id: saleLogRef.id,
      orderId,
      paymentId,
      idProduct: item.id,
      productName: item.name,

      variantId: item.variantId || null,
      variantIndex:
        typeof item.variantIndex === "number" ? item.variantIndex : null,
      variantLabel: item.variantLabel || null,
      variantAttributes: item.variantAttributes || null,

      idUser: payload.idUser || "",
      customerName: payload.customerName || "",
      customerPhone: payload.customerPhone || "",
      idCampaign: item.promotion?.campaignId || null,
      campaignName: item.promotion?.campaignName || null,
      typeUser: payload.typeUser,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      lineTotal: Number(item.lineTotal || 0),
      orderTotalAmount: Number(payload.totalAmount || 0),
      totalProductAmount: Number(payload.totalProductAmount || 0),
      shipFee: Number(payload.shipFee || 0),
      paymentStatus: payload.statusPayment,
      typePayment: payload.typePayment,
      orderStatus: payload.status,
      createdAt,
      dateKey: analyticsTime.dateKey,
      monthKey: analyticsTime.monthKey,
      hourOfDay: analyticsTime.hourOfDay,
      timeBucket: analyticsTime.timeBucket,
      dayOfWeek: analyticsTime.dayOfWeek,
    };

    batch.set(saleLogRef, saleLog);
  });

  await batch.commit();

  return {
    id: orderId,
    paymentId,
  };
};

export const updateUserPurchaseStats = async (params: {
  userId: string;
  orderId: string;
  totalAmount: number;
  usersByPhone: AppUser[];
}) => {
  const { userId, orderId, totalAmount, usersByPhone } = params;
  const userRef = doc(db, "Users", userId);

  await updateDoc(userRef, {
    totalOrders: increment(1),
    totalSpent: increment(Number(totalAmount || 0)),
  }).catch(async () => {
    await updateDoc(userRef, {
      totalOrders: 1,
      totalSpent: Number(totalAmount || 0),
    });
  });

  const userSnapshot = usersByPhone.find((item) => item.id === userId);
  const oldAmountBought = Array.isArray(userSnapshot?.amountBought)
    ? userSnapshot.amountBought
    : [];

  await updateDoc(userRef, {
    amountBought: [
      ...oldAmountBought,
      {
        orderId,
        createdAt: dayjs().toISOString(),
      },
    ],
  });
};

export const updatePromotionStatsForOrder = async (params: {
  products: SelectedOrderProduct[];
  promotions: PromotionDoc[];
}) => {
  const { products, promotions } = params;
  const batch = writeBatch(db);

  const groupedByCampaign = new Map<
    string,
    { revenue: number; quantity: number; productId: string }
  >();

  products.forEach((item) => {
    if (!item.promotion?.campaignId) return;

    const existing = groupedByCampaign.get(item.promotion.campaignId);

    if (existing) {
      groupedByCampaign.set(item.promotion.campaignId, {
        ...existing,
        revenue: existing.revenue + item.lineTotal,
        quantity: existing.quantity + item.quantity,
      });
      return;
    }

    groupedByCampaign.set(item.promotion.campaignId, {
      revenue: item.lineTotal,
      quantity: item.quantity,
      productId: item.id,
    });
  });

  for (const [campaignId, info] of groupedByCampaign.entries()) {
    const promo = promotions.find((item) => item.id === campaignId);
    if (!promo) continue;

    const productIndex = promo.products?.findIndex(
      (item: any) => item.idProduct === info.productId,
    );

    if (productIndex === undefined || productIndex < 0) continue;

    const nextProducts = [...(promo.products || [])];
    nextProducts[productIndex] = {
      ...nextProducts[productIndex],
      usedAmount:
        Number(nextProducts[productIndex].usedAmount || 0) + info.quantity,
      totalSale:
        Number(nextProducts[productIndex].totalSale || 0) + info.quantity,
      totalRevenue:
        Number(nextProducts[productIndex].totalRevenue || 0) +
        Number(info.revenue || 0),
    };

    const promoRef = doc(db, "Promotions", campaignId);
    batch.update(promoRef, {
      products: nextProducts,
      totalSale: increment(info.quantity),
      totalRevenue: increment(info.revenue),
      updatedAt: dayjs().toISOString(),
    });
  }

  await batch.commit();
};

export const ensureConversationForCustomer = async (params: {
  userId: string;
  customerName: string;
}) => {
  const { userId, customerName } = params;
  const customerKey = `user_${userId}`;

  const q = query(
    collection(db, "conversations"),
    where("customerKey", "==", customerKey),
    where("isClosed", "==", false),
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const mainDoc = snapshot.docs[0];

    await updateDoc(doc(db, "conversations", mainDoc.id), {
      customerKey,
      customerUserId: userId,
      customerId: userId,
      customerName: customerName || null,
      participants: [userId, CURRENT_ADMIN_ID],
      updatedAt: serverTimestamp(),
    });

    return mainDoc.id;
  }

  const conversationRef = await addDoc(collection(db, "conversations"), {
    customerKey,
    customerUserId: userId,
    customerId: userId,
    guestSessionId: null,
    customerName: customerName || null,
    customerAvatar: "",
    customerEmail: null,
    customerPhone: null,
    assignedStaffId: CURRENT_ADMIN_ID,
    staffId: CURRENT_ADMIN_ID,
    staffName: "Admin",
    participants: [userId, CURRENT_ADMIN_ID],
    lastMessage: "",
    lastMessageType: "system",
    lastMessageAt: serverTimestamp(),
    lastSenderId: CURRENT_ADMIN_ID,
    unreadCustomer: 0,
    unreadStaff: 0,
    botEnabled: true,
    botPending: false,
    isClosed: false,
    status: "OPEN",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return conversationRef.id;
};

export const sendOrderMessageToCustomer = async (params: {
  userId: string;
  customerName: string;
  products: SelectedOrderProduct[];
  orderId: string;
}) => {
  const { userId, customerName, products, orderId } = params;

  const conversationId = await ensureConversationForCustomer({
    userId,
    customerName,
  });

  const productSummary = products
    .map(
      (item) =>
        `- ${item.name} x${item.quantity} (${formatCurrency(item.lineTotal)})`,
    )
    .join("\n");

  const text = `Shop đã tạo đơn hàng cho anh/chị.\nMã đơn: ${orderId}\nDanh sách sản phẩm:\n${productSummary}`;

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId: CURRENT_ADMIN_ID,
    senderRole: "staff",
    type: "text",
    text,
    imageUrl: null,
    product: null,
    createdAt: serverTimestamp(),
    seenBy: [CURRENT_ADMIN_ID],
    metadata: {
      orderId,
      source: "order_created",
    },
  });

  await updateDoc(doc(db, "conversations", conversationId), {
    customerKey: `user_${userId}`,
    customerUserId: userId,
    customerId: userId,
    customerName: customerName || null,
    participants: [userId, CURRENT_ADMIN_ID],
    lastMessage: `Mã đơn: ${orderId}`,
    lastMessageType: "text",
    lastMessageAt: serverTimestamp(),
    lastSenderId: CURRENT_ADMIN_ID,
    unreadCustomer: increment(1),
    updatedAt: serverTimestamp(),
  });
};

export const cancelOrder = async (orderId: string, cancelReason: string) => {
  await updateDoc(doc(db, "Orders", orderId), {
    status: "CANCELLED",
    cancelReason,
  });
};

export const getVariantByIndex = (product: ProductDoc, variantIndex = 0) => {
  if (!Array.isArray(product?.variants) || !product.variants.length)
    return null;
  return product.variants[variantIndex] || product.variants[0] || null;
};

export const getVariantLabel = (
  variant?: ProductDoc["variants"][number] | null,
) => {
  const attributes = variant?.attributes || {};
  const values = Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" - ");

  return values || "Biến thể mặc định";
};

export const getVariantId = (productId: string, variantIndex = 0) => {
  return `${productId}_${variantIndex}`;
};

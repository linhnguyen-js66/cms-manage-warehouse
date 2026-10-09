import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  PlusCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import type {
  AppUser,
  OrderDoc,
  OrderStatus,
  PaymentStatus,
  ProductDoc,
  PromotionDoc,
  SelectedOrderProduct,
  ShippingProviderId,
  UserLevel,
} from "./order.types";
import {
  ORDER_STATUS_TABS,
  SHIPPING_PROVIDERS,
  SHOWROOM_OPTIONS,
  buildSelectedOrderProduct,
  calcShipFee,
  cancelOrder,
  createOrder,
  findCustomerByPhone,
  formatCurrency,
  getDiscountedUnitPrice,
  getInitialOrderReferences,
  normalizeUserLevel,
  sendOrderMessageToCustomer,
  subscribeOrders,
  updatePromotionStatsForOrder,
  updateUserPurchaseStats,
} from "./order.service";
import {
  cartRowKey,
  createGhnApi,
  createGhnReferenceId,
  firestoreSafe,
  normalizeCartProducts,
  normalizePhone,
  ShippingApiError,
  toGhnOrder,
  normalizeLocationSearch,
  resolveGhnAddress,
} from "@/api/order";
import type {
  GhnOrderInput,
  GhnSync,
  ShippingAddress,
  GhnLocationOption,
} from "@/api/order";

type CartProduct = SelectedOrderProduct & { sku?: string };
type ManagedOrder = OrderDoc & {
  ghn?: GhnSync & { estimatedFee?: number; cancelledAt?: string };
  recipientAddress?: ShippingAddress;
  senderAddress?: ShippingAddress;
  senderName?: string;
  senderPhone?: string;
};
const shippingProviders = SHIPPING_PROVIDERS.some(
  (item) =>
    String(item.id).toUpperCase() === "GHN" ||
    /ghn|giao hàng nhanh/i.test(item.label),
)
  ? SHIPPING_PROVIDERS
  : [
      ...SHIPPING_PROVIDERS,
      {
        id: "GHN" as ShippingProviderId,
        label: "Giao Hàng Nhanh",
        feePerKg: 0,
      },
    ];
const shippingApi = createGhnApi(
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_SHIPPING_API_URL ?? "http://localhost:3001",
);
const isGhnProvider = (value: unknown) => {
  const provider = shippingProviders.find((item) => item.id === value);
  return (
    String(value || "").toUpperCase() === "GHN" ||
    /ghn|giao hàng nhanh/i.test(provider?.label || "")
  );
};
// Firebase products use variants[].prices.btc as the selling price, cost as cost price.
// Customer level stays in Orders; legacy CTV/wholesale prices are no longer selected.
const buildCartProduct = (
  product: ProductDoc,
  promotions: PromotionDoc[],
  promotion: PromotionDoc | null,
  quantity = 1,
  variantIndex = 0,
): CartProduct => {
  const variant = product.variants?.[variantIndex];
  const price = variant?.prices?.btc;
  if (!Number.isSafeInteger(price) || Number(price) < 0) {
    throw new Error(`Sản phẩm ${product.name} thiếu giá bán của biến thể`);
  }
  const built = buildSelectedOrderProduct(
    product,
    "BTC" as UserLevel,
    promotions,
    promotion,
    quantity,
    variantIndex,
  );
  const sku = String(
    (variant as { sku?: string } | undefined)?.sku || "",
  ).trim();
  return firestoreSafe({ ...built, ...(sku ? { sku } : {}), variantIndex });
};

// Ignore responses from an older province or a closed drawer.
function useGhnLocationOptions(
  kind: "province" | "ward",
  provinceId: number | undefined,
  enabled: boolean,
  refreshKey: number,
  onAuthExpired: () => void,
) {
  const [options, setOptions] = useState<GhnLocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let ignore = false;
    setOptions([]);
    setError("");
    setLoading(false);
    if (!enabled || (kind === "ward" && !provinceId)) return;
    setLoading(true);
    const pending =
      kind === "province"
        ? shippingApi.provinces()
        : shippingApi.wards(provinceId!);
    pending
      .then((data) => {
        if (ignore) return;
        setOptions(data);
        if (!data.length)
          setError(
            kind === "province"
              ? "Danh mục tỉnh/thành GHN rỗng; hãy tải lại"
              : "GHN chưa có phường/xã hoạt động cho tỉnh này; hãy tải lại",
          );
      })
      .catch((cause) => {
        if (ignore) return;
        setError(
          cause instanceof Error ? cause.message : "Không tải được địa chỉ GHN",
        );
        if (cause instanceof ShippingApiError && cause.status === 401)
          onAuthExpired();
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [kind, provinceId, enabled, refreshKey, onAuthExpired]);
  return { options, loading, error };
}

const { Text, Title } = Typography;
const Component = () => {
  const [searchForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const [approveForm] = Form.useForm();
  const [ghnLoginForm] = Form.useForm();
  const [ghnLoginOpen, setGhnLoginOpen] = useState(false);
  const [ghnLoginBusy, setGhnLoginBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);
  const syncLocks = useRef(new Set<string>());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const draftReference = useRef("");
  if (!draftReference.current) draftReference.current = createGhnReferenceId();
  const [previewBusy, setPreviewBusy] = useState(false);
  const [ghnEstimate, setGhnEstimate] = useState<number | null>(null);
  const [addressRefresh, setAddressRefresh] = useState(0);

  const [orders, setOrders] = useState<ManagedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<OrderStatus>("PENDING_APPROVAL");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ManagedOrder | null>(null);
  const [usersByPhone, setUsersByPhone] = useState<AppUser[]>([]);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [promotions, setPromotions] = useState<PromotionDoc[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<CartProduct[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState("");
  const [selectedPromotionId, setSelectedPromotionId] = useState<
    string | undefined
  >();
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] =
    useState<ProductDoc | null>(null);
  const getVariantLabel = (variant: any) => {
    const attributes = variant?.attributes || {};
    const values = Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" - ");
    return values || "Biến thể mặc định";
  };
  const promotionOptions = useMemo(() => {
    return promotions
      .filter((item) => item?.status === "ONGOING")
      .map((item) => ({
        value: item.id,
        label: item.name,
      }));
  }, [promotions]);
  const selectedPromotion = useMemo(() => {
    if (!selectedPromotionId) return null;
    return promotions.find((item) => item.id === selectedPromotionId) || null;
  }, [promotions, selectedPromotionId]);
  useEffect(() => {
    // subscribeOrders must retain Firestore data fields (including ghn) in its mapper.
    const unsubscribe = subscribeOrders(setOrders);
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        const { users, products, promotions } =
          await getInitialOrderReferences();
        setUsersByPhone(users);
        setProducts(products);
        setPromotions(promotions);
      } catch (error) {
        console.error(error);
        toast.error("Không tải được dữ liệu hệ thống");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);
  const keyword = Form.useWatch("keyword", searchForm);
  const watchedWeight = Form.useWatch("weight", createForm);
  const watchedProvider = Form.useWatch("idDVVC", createForm);
  const watchedCustomerShipFee = Form.useWatch("customerShipFee", createForm);
  const watchedPayment = Form.useWatch("typePayment", createForm);
  const creatingGhn = isGhnProvider(watchedProvider);
  const recipientProvinceId = Form.useWatch("recipientProvince", createForm) as
    | number
    | undefined;
  const senderProvinceId = Form.useWatch("senderProvince", createForm) as
    | number
    | undefined;
  const onGhnAuthExpired = useCallback(() => setGhnLoginOpen(true), []);
  const addressEnabled = createOpen && creatingGhn;
  const provinces = useGhnLocationOptions(
    "province",
    undefined,
    addressEnabled,
    addressRefresh,
    onGhnAuthExpired,
  );
  const recipientWards = useGhnLocationOptions(
    "ward",
    recipientProvinceId,
    addressEnabled,
    addressRefresh,
    onGhnAuthExpired,
  );
  const senderWards = useGhnLocationOptions(
    "ward",
    senderProvinceId,
    addressEnabled,
    addressRefresh,
    onGhnAuthExpired,
  );
  const locationFilter = (input: string, option?: { searchText?: string }) =>
    String(option?.searchText || "").includes(normalizeLocationSearch(input));

  const filteredOrders = useMemo(() => {
    const normalizedKeyword = String(keyword || "")
      .trim()
      .toLowerCase();
    return orders.filter((item) => {
      const tabMatched = item.status === activeTab;
      const keywordMatched = normalizedKeyword
        ? item.id.toLowerCase().includes(normalizedKeyword)
        : true;
      return tabMatched && keywordMatched;
    });
  }, [orders, activeTab, keyword]);
  const filteredProducts = useMemo(() => {
    const normalizedKeyword = productKeyword.trim().toLowerCase();
    if (!normalizedKeyword) return products;
    return products.filter(
      (item) =>
        item.name?.toLowerCase().includes(normalizedKeyword) ||
        item.id?.toLowerCase().includes(normalizedKeyword),
    );
  }, [productKeyword, products]);
  const shipFeePreview = useMemo(() => {
    return creatingGhn
      ? Number(watchedCustomerShipFee || 0)
      : calcShipFee(watchedProvider, watchedWeight);
  }, [creatingGhn, watchedCustomerShipFee, watchedProvider, watchedWeight]);
  const totalProductAmount = useMemo(
    () =>
      selectedProducts.reduce(
        (sum, item) => sum + Number(item.lineTotal || 0),
        0,
      ),
    [selectedProducts],
  );
  const grandTotalPreview = totalProductAmount + shipFeePreview;
  const handleSearchCustomerByPhone = useCallback(() => {
    const phoneNumber = String(
      createForm.getFieldValue("customerPhone") || "",
    ).trim();
    if (!phoneNumber) {
      toast.warning("Vui lòng nhập số điện thoại khách hàng");
      return;
    }
    const user = findCustomerByPhone(usersByPhone, phoneNumber);
    if (!user) {
      createForm.setFieldsValue({
        idUser: undefined,
        customerName: undefined,
        typeUser: undefined,
        addressReceive: undefined,
        recipientProvince: undefined,
        recipientWard: undefined,
      });
      toast.warning("Không tìm thấy khách hàng trong Users");
      return;
    }
    const typeUser = normalizeUserLevel(user.level);
    createForm.setFieldsValue({
      idUser: user.id,
      customerName: user.name,
      typeUser,
      addressReceive: typeof user.address === "string" ? user.address : "",
      recipientProvince: undefined,
      recipientWard: undefined,
    });
    toast.success("Đã lấy thông tin khách hàng");
  }, [createForm, products, promotions, usersByPhone, selectedPromotion]);
  const addProductToOrder = useCallback(
    (product: ProductDoc, variantIndex = 0) => {
      try {
        const built = buildCartProduct(
          product,
          promotions,
          selectedPromotion,
          1,
          variantIndex,
        );
        const existing = selectedProducts.find(
          (item) => cartRowKey(item) === cartRowKey(built),
        );
        const quantity = (existing?.quantity || 0) + 1;
        if (quantity > 1000)
          throw new Error("Số lượng tối đa 1000 cho mỗi biến thể");
        const next = buildCartProduct(
          product,
          promotions,
          selectedPromotion,
          quantity,
          variantIndex,
        );
        setSelectedProducts((prev) =>
          existing
            ? prev.map((item) =>
                cartRowKey(item) === cartRowKey(next)
                  ? { ...item, ...next }
                  : item,
              )
            : [...prev, next],
        );
        setProductPickerOpen(false);
        setVariantPickerOpen(false);
        setSelectedProductForVariant(null);
        setGhnEstimate(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Không chọn được sản phẩm",
        );
      }
    },
    [promotions, selectedPromotion, selectedProducts],
  );
  const openVariantPickerForAdmin = useCallback(
    (product: ProductDoc) => {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (variants.length <= 1) {
        addProductToOrder(product, 0);
        return;
      }
      setSelectedProductForVariant(product);
      setVariantPickerOpen(true);
    },
    [addProductToOrder],
  );
  const handleChangePromotion = useCallback(
    (promotionId?: string) => {
      const nextPromotion =
        promotions.find((item) => item.id === promotionId) || null;
      try {
        const next = selectedProducts.map((item) => {
          const product = products.find((p) => p.id === item.id);
          return product
            ? {
                ...item,
                ...buildCartProduct(
                  product,
                  promotions,
                  nextPromotion,
                  item.quantity,
                  item.variantIndex ?? 0,
                ),
              }
            : item;
        });
        setSelectedPromotionId(promotionId);
        setSelectedProducts(next);
        setGhnEstimate(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Không đổi được khuyến mại",
        );
      }
    },
    [products, promotions, selectedProducts],
  );
  const updateProductQuantity = useCallback(
    (
      productId: string,
      quantity: number,
      variantIndex = 0,
      variantId?: string,
    ) => {
      try {
        const key = cartRowKey({ id: productId, variantId, variantIndex });
        const safeQty = Math.min(
          1000,
          Math.max(1, Math.floor(Number(quantity || 1))),
        );
        const next = selectedProducts.map((item) => {
          if (cartRowKey(item) !== key) return item;
          const product = products.find((p) => p.id === item.id);
          return product
            ? {
                ...item,
                ...buildCartProduct(
                  product,
                  promotions,
                  selectedPromotion,
                  safeQty,
                  item.variantIndex ?? variantIndex,
                ),
              }
            : {
                ...item,
                quantity: safeQty,
                lineTotal: item.unitPrice * safeQty,
              };
        });
        setSelectedProducts(next);
        setGhnEstimate(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Không đổi được số lượng",
        );
      }
    },
    [products, promotions, selectedProducts, selectedPromotion],
  );
  const handleGhnLogin = async () => {
    try {
      const { password } = await ghnLoginForm.validateFields();
      setGhnLoginBusy(true);
      await shippingApi.login(password);
      ghnLoginForm.resetFields();
      setGhnLoginOpen(false);
      setAddressRefresh((value) => value + 1);
      toast.success("Đã đăng nhập server vận chuyển");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Đăng nhập thất bại",
      );
    } finally {
      setGhnLoginBusy(false);
    }
  };
  const getCreatePayload = useCallback(async () => {
    const values = await createForm.validateFields();
    const cart = normalizeCartProducts(selectedProducts);
    const isGhn = isGhnProvider(values.idDVVC);
    const shipFee = isGhn
      ? Number(values.customerShipFee || 0)
      : calcShipFee(values.idDVVC, values.weight);
    if (!Number.isSafeInteger(shipFee) || shipFee < 0)
      throw new Error("Phí ship thu khách không hợp lệ");
    const totalProduct = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalAmount = totalProduct + shipFee;
    if (!Number.isSafeInteger(totalAmount) || totalAmount > 100000000)
      throw new Error("Tổng tiền vượt giới hạn");
    const paymentStatus: PaymentStatus =
      values.typePayment === "BANK_TRANSFER" && values.paymentReceived
        ? "PAID"
        : "PENDING";
    if (
      isGhn &&
      (provinces.loading || recipientWards.loading || senderWards.loading)
    )
      throw new Error(
        "Đang tải danh mục địa chỉ GHN; chờ tải xong rồi tạo đơn",
      );
    const recipientAddress = isGhn
      ? resolveGhnAddress(
          values.recipientProvince,
          values.recipientWard,
          provinces.options,
          recipientWards.options,
        )
      : undefined;
    const senderAddress = isGhn
      ? resolveGhnAddress(
          values.senderProvince,
          values.senderWard,
          provinces.options,
          senderWards.options,
        )
      : undefined;
    const payload = firestoreSafe({
      idUser: values.idUser,
      customerName: String(values.customerName || "").trim(),
      customerPhone: normalizePhone(values.customerPhone),
      typeUser: values.typeUser,
      branchCode: values.branchCode,
      addressShowroom: String(values.addressShowroom || "").trim(),
      addressReceive: String(values.addressReceive || "").trim(),
      products: cart,
      totalProductAmount: totalProduct,
      shipFee,
      totalAmount,
      idDVVC: values.idDVVC,
      status: "PENDING_SHIPPING" as OrderStatus,
      statusPayment: paymentStatus,
      typePayment: values.typePayment,
      weight: Number(values.weight), // Preserve Firebase kg; GHN mapper converts to grams.
      length: Number(values.length),
      width: Number(values.width),
      height: Number(values.height),
      createdAt: dayjs().toISOString(),
      createdBy: "staff_001",
      ...(isGhn
        ? {
            recipientAddress,
            senderAddress,
            senderName: String(values.senderName || "").trim(),
            senderPhone: normalizePhone(values.senderPhone),
            requiredNote: values.requiredNote || "KHONGCHOXEMHANG",
            insuranceValue: Number(values.insuranceValue || 0),
            shippingNote: String(values.shippingNote || "").trim(),
          }
        : {}),
    });
    return { payload, isGhn, values };
  }, [
    createForm,
    selectedProducts,
    provinces.options,
    recipientWards.options,
    senderWards.options,
    provinces.loading,
    recipientWards.loading,
    senderWards.loading,
  ]);
  const handlePreviewGhn = async () => {
    if (previewBusy || creating) return;
    setPreviewBusy(true);
    setGhnEstimate(null);
    try {
      const { payload, isGhn } = await getCreatePayload();
      if (!isGhn) return;
      const quote = await shippingApi.preview(
        toGhnOrder(payload as GhnOrderInput, draftReference.current),
      );
      if (
        !Number.isSafeInteger(quote.data.total_fee) ||
        quote.data.total_fee < 0
      )
        throw new Error("GHN không trả phí hợp lệ");
      setGhnEstimate(quote.data.total_fee);
    } catch (error) {
      if (error instanceof ShippingApiError && error.status === 401)
        setGhnLoginOpen(true);
      toast.error(
        error instanceof Error ? error.message : "Không xem trước được GHN",
      );
    } finally {
      setPreviewBusy(false);
    }
  };
  const syncOrderToGhn = useCallback(async (order: ManagedOrder) => {
    if (!order.ghn?.request || !order.ghn.referenceId)
      throw new Error(
        "Đơn chưa có snapshot GHN; không tự đoán địa chỉ của đơn cũ",
      );
    if (order.status === "CANCELLED" || order.ghn.cancelledAt)
      throw new Error("Đơn đã hủy");
    if (order.typePayment === "BANK_TRANSFER" && order.statusPayment !== "PAID")
      throw new Error(
        "Chưa xác nhận nhận tiền chuyển khoản; đơn Firebase đã được lưu, chưa gửi GHN",
      );
    if (syncLocks.current.has(order.id)) return;
    syncLocks.current.add(order.id);
    setSyncingId(order.id);
    let upstreamCreated = false;
    let lookupOnly = false;
    let createAttempted = false;
    try {
      let existing;
      try {
        existing = await shippingApi.get(order.ghn.referenceId);
      } catch (error) {
        if (!(error instanceof ShippingApiError && error.code === "NOT_FOUND"))
          throw error;
      }
      let result;
      // The new server has its own database. A missing local record does not
      // mean an older Firebase order was never created at GHN.
      if (
        !existing &&
        ["CREATED", "UNKNOWN", "SUBMITTING"].includes(order.ghn.state)
      ) {
        lookupOnly = true;
        const found = await shippingApi.byClientCode(order.ghn.referenceId);
        if (
          !found.data?.order_code ||
          (found.data.client_order_code &&
            found.data.client_order_code !== order.ghn.referenceId)
        )
          throw new Error(
            "GHN chưa xác nhận đơn theo mã CMS; giữ nguyên mã và đối soát tiếp",
          );
        if (found.data.status === "cancel") {
          await updateDoc(doc(db, "Orders", order.id), {
            "ghn.cancelledAt": dayjs().toISOString(),
            "ghn.error": "Vận đơn đã bị hủy tại GHN",
          });
          throw new Error("Vận đơn đã bị hủy tại GHN; không tạo lại cùng đơn");
        }
        result = {
          status: "CREATED" as const,
          trackingNumber: found.data.order_code,
          simulated: false,
          environment: order.ghn.environment ?? null,
        };
      } else if (!existing || existing.status === "REJECTED") {
        await updateDoc(doc(db, "Orders", order.id), {
          "ghn.state": "SUBMITTING",
          "ghn.error": "",
        });
        createAttempted = true;
        result = await shippingApi.create(order.ghn.request);
      } else if (existing.status === "CREATED") result = existing;
      else result = await shippingApi.reconcile(order.ghn.referenceId);
      if (!result.trackingNumber || result.status !== "CREATED")
        throw new Error("Server chưa trả mã vận đơn");
      upstreamCreated = true;
      await updateDoc(doc(db, "Orders", order.id), {
        "ghn.state": "CREATED",
        "ghn.trackingNumber": result.trackingNumber,
        "ghn.simulated": result.simulated,
        "ghn.environment": result.environment,
        "ghn.syncedAt": dayjs().toISOString(),
        "ghn.error": "",
        "ghn.upstreamCode": null,
      });
      toast.success(
        result.simulated
          ? `Đơn mô phỏng: ${result.trackingNumber}`
          : `Vận đơn GHN: ${result.trackingNumber}${result.environment === "staging" ? " (thử nghiệm)" : ""}`,
      );
    } catch (error) {
      if (error instanceof ShippingApiError && error.status === 401)
        setGhnLoginOpen(true);
      if (upstreamCreated)
        throw new Error(
          "GHN đã tạo vận đơn nhưng Firebase chưa lưu được mã. Bấm Đối soát GHN để lưu lại, không tạo đơn mới.",
        );
      const state = lookupOnly
        ? order.ghn.state
        : createAttempted &&
            error instanceof ShippingApiError &&
            error.code === "GHN_REJECTED"
          ? "REJECTED"
          : error instanceof ShippingApiError &&
              ["GHN_NOT_CONFIGURED", "UNAUTHORIZED"].includes(error.code)
            ? order.ghn.state
            : "UNKNOWN";
      try {
        await updateDoc(doc(db, "Orders", order.id), {
          "ghn.state": state,
          "ghn.error": (error instanceof Error
            ? error.message
            : "Lỗi gửi GHN"
          ).slice(0, 500),
          "ghn.upstreamCode":
            error instanceof ShippingApiError ? error.upstreamCode : null,
        });
      } catch {
        /* The immutable request was saved before any attempt to create on GHN. */
      }
      throw error;
    } finally {
      syncLocks.current.delete(order.id);
      setSyncingId(null);
    }
  }, []);
  const handleSyncGhn = async (order: ManagedOrder) => {
    try {
      await syncOrderToGhn(order);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không đối soát được GHN",
      );
    }
  };
  const handleCreateOrder = useCallback(async () => {
    if (createLock.current || previewBusy) return;
    createLock.current = true;
    setCreating(true);
    let savedOrderId: string | null = null;
    try {
      const { payload, isGhn, values } = await getCreatePayload();
      const request = isGhn
        ? toGhnOrder(payload as GhnOrderInput, draftReference.current)
        : null;
      let estimate: number | undefined;
      if (request) {
        const quote = await shippingApi.preview(request);
        if (
          !Number.isSafeInteger(quote.data.total_fee) ||
          quote.data.total_fee < 0
        )
          throw new Error("GHN không trả phí hợp lệ");
        estimate = quote.data.total_fee;
      }
      const ghn: (GhnSync & { estimatedFee?: number }) | undefined = request
        ? {
            referenceId: request.client_order_code,
            request,
            state:
              payload.typePayment === "BANK_TRANSFER" &&
              payload.statusPayment !== "PAID"
                ? "AWAITING_PAYMENT"
                : "READY",
            estimatedFee: estimate,
          }
        : undefined;
      const orderPayload = firestoreSafe({
        ...payload,
        ...(ghn ? { ghn } : {}),
      });
      const createdOrder = await createOrder(orderPayload);
      savedOrderId = createdOrder.id;
      // Keep the existing service contract. Explicitly persist new GHN metadata before dispatch.
      if (ghn)
        await updateDoc(
          doc(db, "Orders", createdOrder.id),
          firestoreSafe({
            branchCode: payload.branchCode,
            recipientAddress: payload.recipientAddress,
            senderAddress: payload.senderAddress,
            senderName: payload.senderName,
            senderPhone: payload.senderPhone,
            ghn,
          }),
        );
      setCreateOpen(false);
      setSelectedProducts([]);
      setSelectedPromotionId(undefined);
      createForm.resetFields();
      setGhnEstimate(null);
      draftReference.current = createGhnReferenceId();
      const ancillary = await Promise.allSettled([
        updateUserPurchaseStats({
          userId: values.idUser,
          orderId: createdOrder.id,
          totalAmount: payload.totalAmount,
          usersByPhone,
        }),
        updatePromotionStatsForOrder({
          products: payload.products,
          promotions,
        }),
        sendOrderMessageToCustomer({
          userId: values.idUser,
          customerName: payload.customerName,
          products: payload.products,
          orderId: createdOrder.id,
        }),
      ]);
      if (ancillary.some((result) => result.status === "rejected"))
        toast.warning(
          `Đơn ${createdOrder.id} đã lưu; một số cập nhật thống kê/thông báo chưa thành công`,
        );
      if (ghn && ghn.state !== "AWAITING_PAYMENT") {
        await syncOrderToGhn({
          ...orderPayload,
          id: createdOrder.id,
        } as ManagedOrder);
      } else
        toast.success(
          ghn
            ? "Đã lưu đơn Firebase; chờ nhận tiền chuyển khoản trước khi gửi GHN"
            : "Tạo đơn hàng thành công",
        );
    } catch (error) {
      if (error instanceof ShippingApiError && error.status === 401)
        setGhnLoginOpen(true);
      if (savedOrderId) {
        // Never leave a saved order in a form whose Create button could duplicate it.
        setCreateOpen(false);
        setSelectedProducts([]);
        setSelectedPromotionId(undefined);
        createForm.resetFields();
        draftReference.current = createGhnReferenceId();
        toast.warning(
          `Đơn Firebase ${savedOrderId} đã lưu. ${error instanceof Error ? error.message : "Chưa gửi được GHN"}`,
        );
      } else
        toast.error(
          error instanceof Error ? error.message : "Tạo đơn hàng thất bại",
        );
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  }, [
    createForm,
    getCreatePayload,
    previewBusy,
    promotions,
    syncOrderToGhn,
    usersByPhone,
  ]);
  const openDetail = useCallback((order: ManagedOrder) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  }, []);
  const openCancel = useCallback(
    (order: ManagedOrder) => {
      setSelectedOrder(order);
      cancelForm.resetFields();
      setCancelOpen(true);
    },
    [cancelForm],
  );
  const openApprove = useCallback(
    (order: ManagedOrder) => {
      setSelectedOrder(order);
      approveForm.setFieldsValue({
        branchCode: undefined,
        addressShowroom: "",
        approveNote: "",
      });
      setApproveOpen(true);
    },
    [approveForm],
  );
  const handleApproveOrder = useCallback(async () => {
    try {
      const values = await approveForm.validateFields();
      if (!selectedOrder?.id) return;
      const showroom = SHOWROOM_OPTIONS.find(
        (item) => item.value === values.branchCode,
      );
      await updateDoc(doc(db, "Orders", selectedOrder.id), {
        status: "PENDING_SHIPPING",
        branchCode: values.branchCode,
        addressShowroom: values.addressShowroom || showroom?.address || "",
        approveNote: values.approveNote || "",
        approvedAt: dayjs().toISOString(),
        approvedBy: "staff_001",
        updatedAt: dayjs().toISOString(),
      });
      toast.success("Phê duyệt đơn hàng thành công");
      setApproveOpen(false);
      setSelectedOrder(null);
      approveForm.resetFields();
    } catch (error) {
      console.error(error);
      toast.error("Phê duyệt đơn hàng thất bại");
    }
  }, [approveForm, selectedOrder]);
  const handleCancelOrder = useCallback(async () => {
    try {
      const values = await cancelForm.validateFields();
      if (!selectedOrder?.id) return;
      if (selectedOrder.ghn && !selectedOrder.ghn.cancelledAt) {
        if (["UNKNOWN", "SUBMITTING"].includes(selectedOrder.ghn.state))
          throw new Error("Đối soát GHN trước khi hủy đơn chưa rõ kết quả gửi");
        if (
          selectedOrder.ghn.state === "CREATED" &&
          !selectedOrder.ghn.simulated
        ) {
          if (!selectedOrder.ghn.trackingNumber)
            throw new Error("Thiếu mã vận đơn GHN");
          const response = await shippingApi.cancel(
            selectedOrder.ghn.trackingNumber,
          );
          const result = response.data.find(
            (item) => item.order_code === selectedOrder.ghn?.trackingNumber,
          );
          if (!result?.result)
            throw new Error(result?.message || "GHN chưa xác nhận hủy vận đơn");
          await updateDoc(doc(db, "Orders", selectedOrder.id), {
            "ghn.cancelledAt": dayjs().toISOString(),
          });
        }
      }
      await cancelOrder(selectedOrder.id, values.cancelReason);
      toast.success("Đã huỷ đơn hàng");
      setCancelOpen(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error(error);
      if (error instanceof ShippingApiError && error.status === 401)
        setGhnLoginOpen(true);
      toast.error(
        error instanceof Error ? error.message : "Huỷ đơn hàng thất bại",
      );
    }
  }, [cancelForm, selectedOrder]);
  const handleSearch = useCallback(() => {
    searchForm.submit();
  }, [searchForm]);
  const handleReset = useCallback(() => {
    searchForm.resetFields(["keyword"]);
  }, [searchForm]);
  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      width: 180,
    },
    {
      title: "Vận đơn GHN",
      width: 220,
      render: (_: unknown, record: ManagedOrder) =>
        record.ghn ? (
          <div>
            <div>{record.ghn.trackingNumber || "Chưa có mã"}</div>
            <Tag color={record.ghn.state === "CREATED" ? "green" : "gold"}>
              {record.ghn.cancelledAt ? "Đã hủy GHN" : record.ghn.state}
            </Tag>
            {record.ghn.environment === "staging" && <Tag>Thử nghiệm</Tag>}
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: "Khách hàng",
      render: (_: unknown, record: ManagedOrder) => (
        <div>
          <div>{record.customerName}</div>
          <div className="text-12 text-color-700">{record.customerPhone}</div>
        </div>
      ),
      width: 220,
    },
    {
      title: "Loại khách",
      dataIndex: "typeUser",
      render: (value: UserLevel) => {
        if (value === "BTB") return <Tag color="blue">Buôn / sỉ</Tag>;
        if (value === "CTV") return <Tag color="purple">CTV</Tag>;
        return <Tag color="green">Khách lẻ</Tag>;
      },
      width: 120,
    },
    {
      title: "DVVC",
      dataIndex: "idDVVC",
      render: (value: ShippingProviderId) =>
        shippingProviders.find((item) => item.id === value)?.label || "-",
      width: 140,
    },
    {
      title: "Thanh toán",
      render: (_: unknown, record: ManagedOrder) => (
        <div>
          <div>{record.typePayment === "COD" ? "COD" : "Chuyển khoản"}</div>
          <div className="text-12 text-color-700">
            {record.statusPayment === "PAID"
              ? "Đã thanh toán"
              : "Chờ thanh toán"}
          </div>
        </div>
      ),
      width: 180,
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      render: (value: number) => formatCurrency(value),
      width: 150,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
      width: 160,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (value: OrderStatus) => {
        if (value === "PENDING_APPROVAL")
          return <Tag color="blue">Chờ phê duyệt</Tag>;
        if (value === "PENDING_SHIPPING")
          return <Tag color="gold">Đang chờ vận chuyển</Tag>;
        if (value === "SUCCESS") return <Tag color="green">Thành công</Tag>;
        return <Tag color="red">Đã huỷ</Tag>;
      },
      width: 170,
    },
    {
      title: "Thao tác",
      fixed: "right" as const,
      width: 260,
      render: (_: unknown, record: ManagedOrder) => {
        const canRetryPayment =
          record.typePayment === "BANK_TRANSFER" &&
          record.statusPayment !== "PAID" &&
          record.status !== "CANCELLED";
        return (
          <Space>
            <Button size="small" onClick={() => openDetail(record)}>
              Chi tiết
            </Button>
            {record.ghn &&
            record.status === "PENDING_SHIPPING" &&
            !record.ghn.cancelledAt ? (
              <Button
                size="small"
                loading={syncingId === record.id}
                disabled={
                  canRetryPayment ||
                  (syncingId !== null && syncingId !== record.id)
                }
                onClick={() => handleSyncGhn(record)}
              >
                {record.ghn.state === "CREATED"
                  ? "Đối soát GHN"
                  : "Gửi / đối soát GHN"}
              </Button>
            ) : null}
            {record.status === "PENDING_APPROVAL" && !canRetryPayment ? (
              <Button
                size="small"
                type="primary"
                onClick={() => openApprove(record)}
              >
                Phê duyệt
              </Button>
            ) : null}
            {record.status === "PENDING_APPROVAL" ||
            record.status === "PENDING_SHIPPING" ? (
              <Button size="small" danger onClick={() => openCancel(record)}>
                Huỷ
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];
  const productColumns = [
    {
      title: "Ảnh",
      render: (_: unknown, record: ProductDoc) => (
        <img
          src={record.images?.[0]}
          style={{ width: 60, height: 60, objectFit: "cover" }}
        />
      ),
      width: 80,
    },
    {
      title: "ID",
      dataIndex: "id",
      width: 150,
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "name",
      width: 260,
    },
    {
      title: "Danh mục",
      dataIndex: "category",
      width: 160,
    },
    {
      title: "Giá hiện tại",
      render: (_: unknown, record: ProductDoc) => {
        return formatCurrency(
          getDiscountedUnitPrice(
            record,
            "BTC" as UserLevel,
            promotions,
            selectedPromotion,
            1,
          ),
        );
      },
      width: 150,
    },
    {
      title: "Thao tác",
      render: (_: unknown, record: ProductDoc) => (
        <Button
          type="primary"
          size="small"
          onClick={() => openVariantPickerForAdmin(record)}
        >
          Chọn
        </Button>
      ),
      width: 120,
    },
  ];
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  return (
    <div className="block-content">
      <Card
        title="Danh sách vận đơn"
        extra={
          <Button onClick={() => setGhnLoginOpen(true)}>
            Đăng nhập server GHN
          </Button>
        }
      >
        <Form form={searchForm} layout="vertical" autoComplete="off">
          <Row gutter={16} align="bottom">
            <Col span={8}>
              <Form.Item name="keyword" label="Tìm kiếm ID đơn hàng">
                <Input
                  className="h-40"
                  placeholder="Nhập mã đơn hàng"
                  prefix={<SearchOutlined />}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item>
                <Button className="h-40" type="primary" onClick={handleSearch}>
                  Tìm kiếm
                </Button>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item>
                <Button
                  className="h-40"
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item>
                <Button
                  className="h-40"
                  type="primary"
                  icon={<PlusCircleOutlined />}
                  onClick={() => {
                    createForm.resetFields();
                    setSelectedPromotionId(undefined);
                    setSelectedProducts([]);
                    setGhnEstimate(null);
                    draftReference.current = createGhnReferenceId();
                    setCreateOpen(true);
                  }}
                >
                  Thêm mới đơn hàng
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as OrderStatus)}
          items={ORDER_STATUS_TABS.map((item) => ({
            key: item.key,
            label: item.label,
          }))}
        />
        <Table
          rowKey="id"
          bordered
          loading={loading}
          dataSource={filteredOrders}
          columns={columns}
          scroll={{ x: 1600 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Tổng ${total} đơn hàng`,
            onChange: (page, pageSize) => {
              setPagination({
                current: page,
                pageSize: pageSize || 10,
              });
            },
          }}
        />
      </Card>
      <Drawer
        title="Tạo đơn hàng mới"
        width={1200}
        open={createOpen}
        closable={!creating && !previewBusy}
        maskClosable={!creating && !previewBusy}
        onClose={() => {
          if (!creating && !previewBusy) setCreateOpen(false);
        }}
        extra={
          <Space>
            <Button
              disabled={creating || previewBusy}
              onClick={() => setCreateOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="primary"
              loading={creating}
              disabled={previewBusy}
              onClick={handleCreateOrder}
            >
              Tạo đơn hàng
            </Button>
          </Space>
        }
      >
        <Form
          form={createForm}
          layout="vertical"
          autoComplete="off"
          disabled={creating || previewBusy}
          initialValues={{
            idDVVC: shippingProviders.find((item) => isGhnProvider(item.id))
              ?.id,
            typeUser: "BTC",
            typePayment: "COD",
            customerShipFee: 0,
            requiredNote: "KHONGCHOXEMHANG",
            insuranceValue: 0,
            paymentReceived: false,
          }}
          onValuesChange={() => setGhnEstimate(null)}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="customerPhone"
                label="Số điện thoại khách hàng"
                rules={[
                  { required: true, message: "Vui lòng nhập số điện thoại" },
                ]}
              >
                <Input
                  className="h-40"
                  placeholder="Nhập số điện thoại để tìm khách hàng"
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" ">
                <Button
                  className="h-40 w-full"
                  onClick={handleSearchCustomerByPhone}
                >
                  Tìm khách hàng
                </Button>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="idUser"
                label="ID người mua"
                rules={[
                  { required: true, message: "Vui lòng chọn khách hàng" },
                ]}
              >
                <Input className="h-40" disabled />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="typeUser"
                label="Loại khách hàng"
                rules={[{ required: true, message: "Thiếu loại khách hàng" }]}
              >
                <Select
                  size="large"
                  options={[
                    { value: "BTC", label: "Khách lẻ" },
                    { value: "BTB", label: "Khách buôn / sỉ" },
                    { value: "CTV", label: "CTV" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="customerName"
                label="Tên người nhận"
                rules={[{ required: true, message: "Nhập tên người nhận" }]}
              >
                <Input className="h-40" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="branchCode"
                label="Showroom gửi hàng"
                rules={[{ required: true, message: "Vui lòng chọn showroom" }]}
              >
                <Select
                  size="large"
                  options={SHOWROOM_OPTIONS}
                  onChange={(value) => {
                    const showroom = SHOWROOM_OPTIONS.find(
                      (item) => item.value === value,
                    );
                    createForm.setFieldValue(
                      "addressShowroom",
                      showroom?.address || "",
                    );
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="addressShowroom"
                label="Địa chỉ cụ thể lấy hàng (số nhà, đường)"
                rules={[
                  { required: true, message: "Vui lòng nhập địa chỉ showroom" },
                ]}
              >
                <Input className="h-40" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="addressReceive"
                label="Địa chỉ cụ thể người nhận (số nhà, đường)"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng nhập địa chỉ nhận hàng",
                  },
                ]}
              >
                <Input className="h-40" />
              </Form.Item>
            </Col>
          </Row>
          {creatingGhn && (
            <>
              <Divider orientation="left">
                Địa chỉ GHN theo hệ tỉnh + phường/xã mới
              </Divider>
              <Row gutter={16}>
                {(["recipient", "sender"] as const).map((prefix) => {
                  const wards =
                    prefix === "recipient" ? recipientWards : senderWards;
                  const provinceId =
                    prefix === "recipient"
                      ? recipientProvinceId
                      : senderProvinceId;
                  const suffix = prefix === "recipient" ? "nhận" : "lấy hàng";
                  return (
                    <React.Fragment key={prefix}>
                      <Col span={6}>
                        <Form.Item
                          name={`${prefix}Province`}
                          label={`Tỉnh/Thành ${suffix}`}
                          rules={[
                            { required: true, message: "Chọn tỉnh/thành" },
                          ]}
                          validateStatus={provinces.error ? "error" : undefined}
                          help={provinces.error || undefined}
                        >
                          <Select
                            showSearch
                            allowClear
                            optionFilterProp="label"
                            filterOption={locationFilter}
                            loading={provinces.loading}
                            disabled={
                              creating ||
                              previewBusy ||
                              provinces.loading ||
                              !provinces.options.length
                            }
                            options={provinces.options}
                            placeholder="Chọn tỉnh/thành từ GHN"
                            onChange={() => {
                              createForm.setFieldValue(
                                `${prefix}Ward`,
                                undefined,
                              );
                              setGhnEstimate(null);
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          name={`${prefix}Ward`}
                          label={`Phường/Xã ${suffix}`}
                          rules={[
                            { required: true, message: "Chọn phường/xã" },
                          ]}
                          validateStatus={wards.error ? "error" : undefined}
                          help={wards.error || undefined}
                        >
                          <Select
                            showSearch
                            allowClear
                            optionFilterProp="label"
                            filterOption={locationFilter}
                            loading={wards.loading}
                            disabled={
                              creating ||
                              previewBusy ||
                              !provinceId ||
                              wards.loading ||
                              !wards.options.length
                            }
                            options={wards.options}
                            placeholder={
                              provinceId
                                ? "Chọn phường/xã từ GHN"
                                : "Chọn tỉnh/thành trước"
                            }
                          />
                        </Form.Item>
                      </Col>
                    </React.Fragment>
                  );
                })}
                <Col span={12}>
                  <Form.Item
                    name="senderName"
                    label="Tên người gửi"
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input maxLength={100} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="senderPhone"
                    label="Điện thoại lấy hàng"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Button
                size="small"
                disabled={
                  creating ||
                  previewBusy ||
                  provinces.loading ||
                  recipientWards.loading ||
                  senderWards.loading
                }
                onClick={() => {
                  setAddressRefresh((value) => value + 1);
                  setGhnEstimate(null);
                }}
              >
                Tải lại danh mục địa chỉ GHN
              </Button>
              <Text type="secondary">
                Địa chỉ showroom là địa chỉ lấy hàng gửi GHN. Địa chỉ nhận vẫn
                lưu nguyên trường addressReceive; tỉnh/phường được lưu bổ sung,
                không tách tự động từ chuỗi cũ.
              </Text>
            </>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Chương trình khuyến mại">
                <Select
                  size="large"
                  allowClear
                  placeholder="Chọn chương trình khuyến mại"
                  options={promotionOptions}
                  value={selectedPromotionId}
                  onChange={handleChangePromotion}
                />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">Sản phẩm</Divider>
          <div className="mb-16 flex items-center justify-between">
            <Title level={5} className="!mb-0">
              Danh sách sản phẩm trong đơn
            </Title>
            <Button type="primary" onClick={() => setProductPickerOpen(true)}>
              Chọn sản phẩm
            </Button>
          </div>
          <Table
            rowKey={cartRowKey}
            bordered
            dataSource={selectedProducts}
            pagination={false}
            locale={{ emptyText: "Chưa chọn sản phẩm" }}
            columns={[
              {
                title: "Sản phẩm",
                render: (_: unknown, record: CartProduct) => (
                  <div className="flex items-center">
                    <img
                      src={record.image}
                      style={{ width: 48, height: 48, objectFit: "cover" }}
                    />
                    <div className="ml-12">
                      <div>{record.name}</div>
                      <div className="text-12 text-color-700">
                        SKU: {record.sku || "Chưa có SKU"}
                      </div>
                      {record.variantLabel ? (
                        <div className="text-12 text-color-700">
                          {record.variantLabel}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ),
              },
              {
                title: "Giá",
                dataIndex: "unitPrice",
                render: (value: number) => formatCurrency(value),
                width: 150,
              },
              {
                title: "Số lượng",
                render: (_: unknown, record: CartProduct) => (
                  <InputNumber
                    min={1}
                    max={1000}
                    precision={0}
                    value={record.quantity}
                    onChange={(value) =>
                      updateProductQuantity(
                        record.id,
                        Number(value || 1),
                        Number(record.variantIndex || 0),
                        record.variantId,
                      )
                    }
                  />
                ),
                width: 120,
              },
              {
                title: "Khuyến mãi",
                render: (_: unknown, record: CartProduct) =>
                  record.promotion ? (
                    <div>
                      <div>{record.promotion.campaignName}</div>
                      <div className="text-12 text-color-700">
                        {record.promotion.discountType === "percent"
                          ? `${record.promotion.discountValue}%`
                          : formatCurrency(record.promotion.discountValue)}
                      </div>
                    </div>
                  ) : (
                    <Text type="secondary">Không áp dụng</Text>
                  ),
                width: 220,
              },
              {
                title: "Thành tiền",
                dataIndex: "lineTotal",
                render: (value: number) => formatCurrency(value),
                width: 150,
              },
              {
                title: "Thao tác",
                render: (_: unknown, record: CartProduct) => (
                  <Popconfirm
                    title="Xoá sản phẩm khỏi đơn hàng?"
                    onConfirm={() =>
                      setSelectedProducts((prev) =>
                        prev.filter(
                          (item) => cartRowKey(item) !== cartRowKey(record),
                        ),
                      )
                    }
                  >
                    <Button danger size="small">
                      Xoá
                    </Button>
                  </Popconfirm>
                ),
                width: 100,
              },
            ]}
          />
          <Divider orientation="left">Vận chuyển & thanh toán</Divider>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="idDVVC"
                label="Đơn vị vận chuyển"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng chọn đơn vị vận chuyển",
                  },
                ]}
              >
                <Select
                  size="large"
                  options={shippingProviders.map((item) => ({
                    value: item.id,
                    label: isGhnProvider(item.id)
                      ? item.label
                      : `${item.label} (${formatCurrency(item.feePerKg)}/kg)`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="weight"
                label="Khối lượng (kg)"
                rules={[
                  { required: true, message: "Vui lòng nhập khối lượng" },
                ]}
              >
                <InputNumber
                  className="h-40 w-full"
                  min={0.001}
                  max={creatingGhn ? 19.999 : undefined}
                  precision={3}
                  step={0.1}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="length"
                label="Dài (cm)"
                rules={[{ required: true, message: "Vui lòng nhập chiều dài" }]}
              >
                <InputNumber
                  className="h-40 w-full"
                  min={1}
                  max={200}
                  precision={0}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="width"
                label="Rộng (cm)"
                rules={[
                  { required: true, message: "Vui lòng nhập chiều rộng" },
                ]}
              >
                <InputNumber
                  className="h-40 w-full"
                  min={1}
                  max={200}
                  precision={0}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="height"
                label="Cao (cm)"
                rules={[{ required: true, message: "Vui lòng nhập chiều cao" }]}
              >
                <InputNumber
                  className="h-40 w-full"
                  min={1}
                  max={200}
                  precision={0}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="typePayment"
                label="Hình thức thanh toán"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng chọn hình thức thanh toán",
                  },
                ]}
              >
                <Radio.Group>
                  <Radio value="COD">COD</Radio>
                  <Radio value="BANK_TRANSFER">Chuyển khoản</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          {watchedPayment === "BANK_TRANSFER" && (
            <Form.Item
              name="paymentReceived"
              label="Xác nhận đã nhận đủ tiền hàng và phí ship"
            >
              <Radio.Group>
                <Radio value={false}>Chưa nhận tiền</Radio>
                <Radio value={true}>Đã kiểm tra và nhận đủ tiền</Radio>
              </Radio.Group>
            </Form.Item>
          )}
          {creatingGhn && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="customerShipFee"
                    label="Phí ship thu khách (0 = freeship)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      min={0}
                      max={50000000}
                      precision={0}
                      className="w-full"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="insuranceValue" label="Giá trị khai giá (đ)">
                    <InputNumber
                      min={0}
                      max={5000000}
                      precision={0}
                      className="w-full"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="requiredNote" label="Quy định xem hàng">
                    <Select
                      options={[
                        {
                          value: "KHONGCHOXEMHANG",
                          label: "Không cho xem hàng",
                        },
                        {
                          value: "CHOXEMHANGKHONGTHU",
                          label: "Cho xem, không thử",
                        },
                        { value: "CHOTHUHANG", label: "Cho thử hàng" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="shippingNote" label="Ghi chú giao hàng">
                <Input.TextArea maxLength={5000} rows={2} />
              </Form.Item>
              <Space>
                <Button
                  loading={previewBusy}
                  disabled={creating}
                  onClick={handlePreviewGhn}
                >
                  Kiểm tra địa chỉ & phí GHN
                </Button>
                <Text>
                  Phí GHN dự kiến:{" "}
                  {ghnEstimate === null
                    ? "Chưa kiểm tra"
                    : formatCurrency(ghnEstimate)}
                </Text>
              </Space>
              <div>
                <Text type="secondary">
                  Shop thanh toán phí với GHN. COD gồm tiền hàng + phí thu
                  khách; chuyển khoản đã trả đủ thì COD = 0. Phí GHN dự kiến
                  không tự cộng vào tiền thu khách.
                </Text>
              </div>
            </>
          )}
          <Card size="small" className="mt-16">
            <Row gutter={16}>
              <Col span={8}>
                <div className="text-14 text-color-700">Tiền hàng</div>
                <div className="text-18 font-semibold">
                  {formatCurrency(totalProductAmount)}
                </div>
              </Col>
              <Col span={8}>
                <div className="text-14 text-color-700">Phí ship thu khách</div>
                <div className="text-18 font-semibold">
                  {formatCurrency(shipFeePreview)}
                </div>
              </Col>
              <Col span={8}>
                <div className="text-14 text-color-700">Tổng thanh toán</div>
                <div className="text-20 font-semibold text-primary-500">
                  {formatCurrency(grandTotalPreview)}
                </div>
              </Col>
            </Row>
          </Card>
        </Form>
      </Drawer>
      <Modal
        title="Đăng nhập server GHN"
        open={ghnLoginOpen}
        confirmLoading={ghnLoginBusy}
        onOk={handleGhnLogin}
        onCancel={() => {
          if (!ghnLoginBusy) {
            setGhnLoginOpen(false);
            ghnLoginForm.resetFields();
          }
        }}
      >
        <Form form={ghnLoginForm} layout="vertical">
          <Form.Item
            name="password"
            label="Mật khẩu quản trị server (ADMIN_PASSWORD)"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Chọn sản phẩm"
        open={productPickerOpen}
        width={1100}
        footer={null}
        onCancel={() => setProductPickerOpen(false)}
      >
        <div className="mb-16 flex items-center gap-12">
          <Input
            placeholder="Tìm theo ID hoặc tên sản phẩm"
            value={productKeyword}
            onChange={(e) => setProductKeyword(e.target.value)}
          />
        </div>
        <Table
          rowKey="id"
          bordered
          dataSource={filteredProducts}
          columns={productColumns}
          scroll={{ x: 900, y: 500 }}
          pagination={{ pageSize: 8 }}
        />
      </Modal>
      <Modal
        title="Chi tiết đơn hàng"
        open={detailOpen}
        width={1000}
        footer={null}
        onCancel={() => setDetailOpen(false)}
      >
        {selectedOrder ? (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-8 font-medium">
                  Mã đơn: {selectedOrder.id}
                </div>
                <div>Khách hàng: {selectedOrder.customerName}</div>
                <div>SĐT: {selectedOrder.customerPhone}</div>
                <div>Loại khách: {selectedOrder.typeUser}</div>
                <div>Địa chỉ nhận: {selectedOrder.addressReceive}</div>
                {selectedOrder.ghn && (
                  <>
                    <div>Mã gửi GHN: {selectedOrder.ghn.referenceId}</div>
                    <div>Đồng bộ GHN: {selectedOrder.ghn.state}</div>
                    <div>
                      Vận đơn: {selectedOrder.ghn.trackingNumber || "Chưa có"}
                      {selectedOrder.ghn.environment === "staging"
                        ? " (thử nghiệm)"
                        : ""}
                    </div>
                    {selectedOrder.ghn.error && (
                      <Text type="danger">{selectedOrder.ghn.error}</Text>
                    )}
                  </>
                )}
              </Col>
              <Col span={12}>
                <div>Showroom gửi: {selectedOrder.addressShowroom || "-"}</div>
                <div>
                  DVVC:{" "}
                  {shippingProviders.find(
                    (item) => item.id === selectedOrder.idDVVC,
                  )?.label || "-"}
                </div>
                <div>
                  Thanh toán:{" "}
                  {selectedOrder.typePayment === "COD" ? "COD" : "Chuyển khoản"}
                </div>
                <div>
                  Trạng thái thanh toán:{" "}
                  {selectedOrder.statusPayment === "PAID"
                    ? "Đã thanh toán"
                    : "Chờ thanh toán"}
                </div>
                {selectedOrder.approveNote ? (
                  <div>Ghi chú điều phối: {selectedOrder.approveNote}</div>
                ) : null}
                <div>
                  Ngày tạo:{" "}
                  {dayjs(selectedOrder.createdAt).format("DD/MM/YYYY HH:mm")}
                </div>
              </Col>
            </Row>
            <Divider />
            <Table
              rowKey={cartRowKey}
              bordered
              pagination={false}
              dataSource={selectedOrder.products}
              columns={[
                { title: "Sản phẩm", dataIndex: "name" },
                {
                  title: "Giá",
                  dataIndex: "unitPrice",
                  render: (value: number) => formatCurrency(value),
                },
                { title: "SL", dataIndex: "quantity" },
                {
                  title: "Thành tiền",
                  dataIndex: "lineTotal",
                  render: (value: number) => formatCurrency(value),
                },
              ]}
            />
            <Divider />
            <div className="flex justify-end">
              <div className="w-[320px] rounded-radius-m bg-color-100 p-16">
                <div className="mb-8 flex justify-between">
                  <span>Tiền hàng</span>
                  <span>
                    {formatCurrency(selectedOrder.totalProductAmount)}
                  </span>
                </div>
                <div className="mb-8 flex justify-between">
                  <span>Phí ship</span>
                  <span>{formatCurrency(selectedOrder.shipFee)}</span>
                </div>
                <div className="flex justify-between text-16 font-semibold text-primary-500">
                  <span>Tổng cộng</span>
                  <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        title="Phê duyệt đơn hàng"
        open={approveOpen}
        width={800}
        footer={null}
        onCancel={() => {
          setApproveOpen(false);
          setSelectedOrder(null);
          approveForm.resetFields();
        }}
      >
        {selectedOrder ? (
          <Form form={approveForm} layout="vertical">
            <div className="mb-16 rounded-radius-m bg-color-100 p-16">
              <div className="font-medium">Đơn hàng: {selectedOrder.id}</div>
              <div>Khách hàng: {selectedOrder.customerName}</div>
              <div>SĐT: {selectedOrder.customerPhone}</div>
              <div>Địa chỉ nhận: {selectedOrder.addressReceive}</div>
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="branchCode"
                  label="Kho / showroom xuất hàng"
                  rules={[
                    { required: true, message: "Vui lòng chọn kho xuất hàng" },
                  ]}
                >
                  <Select
                    size="large"
                    options={SHOWROOM_OPTIONS}
                    onChange={(value) => {
                      const showroom = SHOWROOM_OPTIONS.find(
                        (item) => item.value === value,
                      );
                      approveForm.setFieldValue(
                        "addressShowroom",
                        showroom?.address || "",
                      );
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="addressShowroom"
                  label="Địa chỉ kho / showroom"
                  rules={[
                    { required: true, message: "Vui lòng nhập địa chỉ kho" },
                  ]}
                >
                  <Input className="h-40" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="approveNote" label="Ghi chú điều phối">
              <Input.TextArea
                rows={4}
                placeholder="Nhập ghi chú nội bộ / điều phối đơn hàng"
              />
            </Form.Item>
            <div className="flex justify-end gap-12">
              <Button
                onClick={() => {
                  setApproveOpen(false);
                  setSelectedOrder(null);
                  approveForm.resetFields();
                }}
              >
                Đóng
              </Button>
              <Button type="primary" onClick={handleApproveOrder}>
                Xác nhận phê duyệt
              </Button>
            </div>
          </Form>
        ) : null}
      </Modal>
      <Modal
        title="Huỷ đơn hàng"
        open={cancelOpen}
        width={900}
        footer={null}
        onCancel={() => setCancelOpen(false)}
      >
        {selectedOrder ? (
          <>
            <div className="mb-16 rounded-radius-m bg-color-100 p-16">
              <div className="font-medium">Đơn hàng: {selectedOrder.id}</div>
              <div>Khách hàng: {selectedOrder.customerName}</div>
              <div>Tổng tiền: {formatCurrency(selectedOrder.totalAmount)}</div>
            </div>
            <Form form={cancelForm} layout="vertical">
              <Form.Item
                name="cancelReason"
                label="Lý do huỷ đơn"
                rules={[
                  { required: true, message: "Vui lòng nhập lý do huỷ đơn" },
                ]}
              >
                <Input.TextArea rows={4} placeholder="Nhập lý do huỷ đơn" />
              </Form.Item>
              <div className="flex justify-end gap-12">
                <Button onClick={() => setCancelOpen(false)}>Đóng</Button>
                <Button danger type="primary" onClick={handleCancelOrder}>
                  Xác nhận huỷ đơn
                </Button>
              </div>
            </Form>
          </>
        ) : null}
      </Modal>
      <Modal
        title="Chọn biến thể sản phẩm"
        open={variantPickerOpen}
        width={800}
        footer={null}
        onCancel={() => {
          setVariantPickerOpen(false);
          setSelectedProductForVariant(null);
        }}
      >
        {selectedProductForVariant ? (
          <>
            <div className="mb-16 rounded-radius-m bg-color-100 p-16">
              <div className="font-medium">
                {selectedProductForVariant.name}
              </div>
              <div className="text-12 text-color-700">
                {selectedProductForVariant.id}
              </div>
            </div>
            <Table
              rowKey={(_, index) => `${selectedProductForVariant.id}_${index}`}
              bordered
              pagination={false}
              dataSource={selectedProductForVariant.variants || []}
              columns={[
                {
                  title: "Biến thể",
                  render: (_: any, record: any) => getVariantLabel(record),
                },
                {
                  title: "Tồn kho",
                  dataIndex: "stock",
                  width: 120,
                },
                {
                  title: "SKU",
                  dataIndex: "sku",
                  width: 160,
                },
                {
                  title: "Giá bán",
                  render: (_: unknown, record: { prices?: { btc?: number } }) =>
                    formatCurrency(Number(record.prices?.btc ?? 0)),
                  width: 140,
                },
                {
                  title: "Thao tác",
                  width: 120,
                  render: (_: any, record: any, index: number) => (
                    <Button
                      type="primary"
                      onClick={() =>
                        addProductToOrder(selectedProductForVariant, index)
                      }
                    >
                      Chọn
                    </Button>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
};
const ManageCart = memo(Component);
export { ManageCart };

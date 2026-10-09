type PromotionStatus = "UPCOMING" | "ONGOING" | "DISABLED" | "EXPIRED";
type PromotionScope = "CUSTOMER" | "CART" | "PRODUCT";
type DiscountType = "percent" | "amount";

interface PromotionProductItem {
  idProduct: string;
  productName: string;
  category?: string;
  image?: string;
  priceBtc?: number | null;
  priceBtb?: number | null;
  priceCtv?: number | null;
  totalSale: number;
  totalRevenue: number;
}

interface PromotionUserBoughtItem {
  idUser: string;
  totalCart: number;
  total: number;
  boughtAt?: string;
}

interface PromotionCustomerConfig {
  customerType: "CUSTOMER" | "BTB" | "CTV";
  discountValue: number;
  totalAmount: number;
}

interface PromotionCartConfig {
  priceFrom: number;
  priceTo: number;
  totalAmount: number;
}

interface PromotionData {
  name: string;
  startDate: string;
  expiredDate: string;
  status: PromotionStatus;
  scope: PromotionScope;
  discountType: DiscountType;

  totalAmount?: number;

  products: PromotionProductItem[];
  userBought: PromotionUserBoughtItem[];

  customerConfigs?: PromotionCustomerConfig[];
  cartConfig?: PromotionCartConfig | null;

  createdAt: string;
  updatedAt: string;
}


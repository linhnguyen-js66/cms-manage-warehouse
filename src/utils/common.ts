import dayjs from "dayjs";
import { jwtDecode } from "jwt-decode";
import { store } from "@/store/store";

export const formatPrice = (num: string | number = "") => {
  if (!num) {
    return "0đ";
  }

  num = Number(num) % 1 !== 0 ? Number(num)?.toFixed(2) : num;
  num = String(num);

  if (typeof num === "number" || typeof num === "string") {
    num = num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  }

  return num + "đ";
};
function isObject(object: any) {
  return object != null && typeof object === "object";
}
export const shallowEqual = (oldObj: any, newObj: any) => {
  return Object.keys(oldObj).filter((key) => oldObj[key] !== newObj[key]);
};

export const removeValueUndefined = (obj: any) => {
  Object.keys(obj).forEach((key) =>
    obj[key] === undefined ? delete obj[key] : {},
  );
  return obj;
};

export const convertToDate = (date: any | null) => {
  return date
    ? dayjs(date).startOf("day").format("YYYY-MM-DDTHH:mm:ss.SSS")
    : "";
};

export const validateDates = (fromDate, toDate) => {
  if (!fromDate && !toDate) {
    return { valid: true };
  }

  const from = dayjs(fromDate, "DD-MM-YYYY", true);
  const to = dayjs(toDate, "DD-MM-YYYY", true);

  if (fromDate && !from.isValid()) {
    return { valid: false, message: "Ngày bắt đầu không hợp lệ." };
  }

  if (toDate && !to.isValid()) {
    return { valid: false, message: "Ngày kết thúc không hợp lệ." };
  }

  if (from.isValid() && to.isValid() && from.isAfter(to)) {
    return {
      valid: false,
      message: "Ngày bắt đầu không được lớn hơn ngày kết thúc.",
    };
  }

  return { valid: true };
};

export const decodeToken = (token: string): any | null => {
  try {
    const decodedToken = jwtDecode<any>(token);
    return decodedToken;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
};
export function numberWithCommas(x: any) {
  if (isNaN(x)) return;
  if (x) return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function convertBase64(
  file: File,
): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64Data: any = reader.result.split(",")[1];
        resolve(base64Data);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };

    reader.readAsDataURL(file);
  });
}

export function getLastDayOfMonth(dateString: string) {
  return dayjs(dateString).endOf("month").format("DD/MM/YYYY");
}

export const isPermited = (roleName: string[]) => {
  const { userInfo: detail }: any = store.getState().userInfo;
  const roles = detail?.role as any[];

  if (typeof roleName == "string") {
    return roles.some((roleCode) => roleCode == roleName);
  }
  return roles?.some((roleCode: any) => roleName.includes(roleCode));
};


export const transformProducts = (rows: any[]) => {

  const products: any = {};

  rows.forEach(row => {

    const id = row?.id;

    if (!products[id]) {

      const attributes = {};
      const images: any = [];

      Object.entries(row).forEach(([key,value])=>{

        if(key.startsWith("attribute_")){
          attributes[key.replace("attribute_","")] = value;
        }

        if(key.startsWith("image") && value){
          images.push(value);
        }

      });

      products[id] = {
        id,
        name: row?.name,
        category: row?.category,
        description: row?.description || "",
        quality: row?.quality,
        origin: row?.origin,
        guarantee: row?.guarantee,
        status: row?.status,
        createAt: row?.createAt,

        attributes,
        images,
        variants:[]
      }

    }

    const variantAttributes = {};

    Object.entries(row).forEach(([key,value])=>{
      if(key.startsWith("attribute_")){
        variantAttributes[key.replace("attribute_","")] = value;
      }
    });

    const prices = {};

    Object.entries(row).forEach(([key,value])=>{
      if(key.startsWith("price_")){
        prices[key.replace("price_","")] = Number(value);
      }
    });

    products[id].variants.push({
      attributes: variantAttributes,
      stock: Number(row?.amount),
      prices
    });

  });

  return Object.values(products);

};
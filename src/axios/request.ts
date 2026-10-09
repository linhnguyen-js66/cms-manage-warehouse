import axios, { AxiosRequestConfig, Method } from "axios";
import { toast } from "react-toastify";
import { hideLoading, showLoading } from "@/page/loading";
import dayjs from "dayjs";

const axiosInstance = axios.create({
  timeout: 30000,
});

// === REQUEST INTERCEPTOR ===
axiosInstance.interceptors.request.use(
  (config) => {
    showLoading();

    const token = localStorage.getItem("token");

    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    return config;
  },
  (error) => {
    hideLoading();
    return Promise.reject(error);
  }
);

// === RESPONSE INTERCEPTOR ===
axiosInstance.interceptors.response.use(
  (response) => {
    hideLoading();
    return response?.data;
  },
  async (error) => {
    hideLoading();

    if (error.response) {
      const { status } = error.response;

      switch (status) {
        case 401:
          toast.error("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại");

          // XÓA TOKEN
          localStorage.removeItem("token");

          // REDIRECT ĐI LOGIN
          setTimeout(() => {
            window.location.href = "/login";
          }, 500);

          break;

        case 403:
          toast.error("Bạn không có quyền thực hiện hành động này");
          break;

        case 404:
          toast.error("API không tồn tại");
          break;

        case 500:
          toast.error("Server lỗi, vui lòng thử lại sau");
          break;

        default:
          toast.error("Lỗi không xác định");
      }
    } else if (error.request) {
      toast.error("Không có phản hồi từ server, kiểm tra kết nối mạng");
    } else {
      toast.error("Đã có lỗi xảy ra");
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

export type Response<T = any> = {
  status?: boolean;
  message?: string;
  result: T;
};

export type MyResponse<T = any> = Promise<Response<T>>;

export const request = <T = any>(
  method: Lowercase<Method>,
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): MyResponse<T> => {

  const configRequest: AxiosRequestConfig = {
    ...config,
  };

  localStorage.setItem("startGetToken", dayjs().toISOString());

  if (method === "post") {
    return axiosInstance.post(url, data, configRequest);
  }
  if (method === "put") {
    return axiosInstance.put(url, data, configRequest);
  }
  if (method === "delete") {
    return axiosInstance.delete(url, configRequest);
  }

  return axiosInstance.get(url, {
    params: data,
    ...configRequest,
  });
};

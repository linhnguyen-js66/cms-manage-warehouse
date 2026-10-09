import { request } from "@/axios/request";

const BASE_URL = "http://127.0.0.1:8000";

export const sendExcelToApi = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return request("post", BASE_URL + "/predict", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      Accept: "application/json",
    },
  });
};

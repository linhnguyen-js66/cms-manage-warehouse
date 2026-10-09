import { getToken } from "@/store/login";
import { useSelector } from "react-redux";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";

const renderTitlePage = (title: string) => {
  return (document.title = title);
};

const renderToken = () => {
  const { access_token } = useSelector(getToken);

  return access_token;
};

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const convertToDate = (date: any | null) => {
  return date ? dayjs(date).format("YYYY-MM-DDTHH:mm:ss.SSS") : "";
};

function numberWithCommas(x: any) {
  if(isNaN(x)) return
  if (x) return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function removeCommas(value: string) {
  return value.replace(/,/g, "");
}

const decodeToken = (token: string): any | null => {
  try {
    const decodedToken = jwtDecode<any>(token);
    return decodedToken;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
};
const convertFileToBase64 = (file: File): Promise<string> => {
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
};

const convertToBase64 = async (url:any) => {
  try {
    console.log(url)
    const response = await fetch(url);
    const blob = await response.blob();

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];
      console.log(base64String);
      return base64String
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error fetching or converting file:", error);
  }
};

const readExcelFile = (file: File) => {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const data = new Uint8Array(event.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      resolve(jsonData);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsArrayBuffer(file);
  });
};

const transformData = (data: any) => {
  return data?.map((row: any, index: number) => ({
    number: index + 1,
    question: row["Câu hỏi"],
    answers: row["Câu trả lời"],
  }));
};

const createTemplateFileFromQuestions = async (data: any) => {
  const worksheet = await XLSX.utils.aoa_to_sheet(data);
  const workbook = await XLSX.utils.book_new();
  await XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");

  await XLSX.writeFile(workbook, "questions_template.xlsx");
};

const checkHaveRole = (roleName: string[]) => {
  const token = localStorage.getItem("token");
  const result = decodeToken(token!);

  return result?.realm_access?.roles.some((element) =>
    roleName?.includes(element)
  );
};

export const formatMoney = (num: number | string | undefined | null) => {
  if (!num) {
    return 0;
  }

  if (typeof num === 'string') {
    return num.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }

  if (typeof num === 'number') {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }
  return '';
};
function checkBool(value: string | boolean | undefined) {
  let isCardBool = false;
  if ((typeof value === 'string' && value === 'true') || (typeof value === 'boolean' && value)) {
    isCardBool = true;
  }
  return isCardBool;
}

function formatNumberAcountBankVsCCCD(numberAcountBank: string | undefined) {
  // return numberAcountBank;
  if (numberAcountBank) {
    numberAcountBank = numberAcountBank.replaceAll(' ', '');
    const chunkSize = 4;
    const content = [];
    for (let i = 0; i < numberAcountBank?.length; i += chunkSize) {
      const chunk = numberAcountBank.slice(i, i + chunkSize);
      content.push(chunk);
    }
    return content.join(' ');
  } else {
    return numberAcountBank;
  }
}

export {
  renderTitlePage,
  renderToken,
  useDebounce,
  convertToDate,
  numberWithCommas,
  removeCommas,
  decodeToken,
  convertFileToBase64,
  readExcelFile,
  transformData,
  createTemplateFileFromQuestions,
  checkHaveRole,
  convertToBase64,
  checkBool,
  formatNumberAcountBankVsCCCD
};

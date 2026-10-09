import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

export const ExportExcel: any = () => {
  const [listData, setListData] = useState<any[]>([]);
  const [triggerExport, setTriggerExport] = useState(false);

  const handleExcel = async (excelData: Object[], fileName: string) => {
    const Heading = [["ID", "Câu hỏi", "Câu trả lời"]];

    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, Heading);

    const colLengths: any = excelData.length
      ? Object.keys(excelData[0]).map((k) => k.toString().length)
      : [];

    for (const d of excelData) {
      Object.values(d).forEach((element: any, index) => {
        const length = element ? element.toString().length : 5;
        if (colLengths[index] < length) {
          colLengths[index] = length + 2;
        }
      });
    }

    ws["!cols"] = colLengths.map((l) => ({
      wch: l,
    }));

    XLSX.utils.sheet_add_json(ws, excelData, {
      origin: "A2",
      skipHeader: true,
    });

    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, fileName);
  };

  const mapDataForExcel = (data: any) => {
    return data.map((item: any) => ({
      ID: item.number,
      Question: item.question,
      Answer: item.answers,
    }));
  };

  const handleExportExcel = async () => {
    const example: any = [
      {
        question: "Tên bạn là gì ? ",
        answers: "Dũng Phạm",
        number: 1,
      },
      {
        question: "Khi nào bạn đi Singgapore ?",
        answers: "Sau khi có ielts",
        number: 2,
      },
      {
        question: "Bạn đang có tiếng anh level nào ?",
        answers: "Đang cố gắng",
        number: 3,
      },
    ];
    setListData(example);
    setTriggerExport(true); 
  };

  useEffect(() => {
    if (triggerExport && listData.length > 0) {
      const excelData = mapDataForExcel(listData);
      handleExcel(excelData, "TEMPLATE_EXAMPLE.xlsx");
      setTriggerExport(false); 
    }
  }, [triggerExport, listData]);

  return (
    <div className="btn-export">
      <Button type="dashed" className="w-full" icon={<DownloadOutlined />} onClick={handleExportExcel}>
        Tải file mẫu
      </Button>
    </div>
  );
};

export default ExportExcel;
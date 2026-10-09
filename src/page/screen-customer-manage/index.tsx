import MyDatePicker from "@/components/basic/date-picker";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Upload,
  UploadProps,
} from "antd";
import Dragger from "antd/es/upload/Dragger";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import saveAs from "file-saver";
import {
  CheckOutlined,
  DownloadOutlined,
  EditFilled,
  ExportOutlined,
  EyeOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { hideLoading, showLoading } from "../loading";
import { toast } from "react-toastify";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { LEVEL_CUSTOMER, STATUS_COLOR, STATUS_CUSTOMER } from "@/constant";

type CustomerLevel = "BTB" | "CTV";
type CustomerStatus = "PENDING" | "ACTIVE" | "LOCKED";

type CustomerRecord = {
  id: string;
  name: string;
  dateOfBirth?: string;
  email?: string;
  phoneNumber: string;
  address?: string;
  level: CustomerLevel;
  status: CustomerStatus;
  isStaff: false;
  branchCode?: string;
  saleOwnerId?: string;
  saleOwnerName?: string;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
};

type StaffRecord = {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  isStaff: true;
};

const CUSTOMER_LEVEL_OPTIONS = [
  { value: "BTC", label: "Khách lẻ" },
  { value: "BTB", label: "Khách buôn / sỉ" },
  { value: "CTV", label: "CTV" },
];

const CUSTOMER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "LOCKED", label: "Đã khóa" },
];

const CURRENT_ADMIN_ID = "staff_001";

const normalizePhone = (value?: string) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\d+]/g, "")
    .trim();

const createCustomerId = () => `CUS${dayjs().format("YYMMDDHHmmssSSS")}`;

const Component = () => {
  const [form] = Form.useForm();
  const [customerForm] = Form.useForm();

  const [file, setFile] = useState<File | null>(null);
  const [errorFile, setErrorFile] = useState(false);

  const [openExcelModal, setOpenExcelModal] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<
    "CREATE" | "EDIT" | "VIEW"
  >("CREATE");

  const [excelData, setExcelData] = useState<any[]>([]);
  const [users, setUsers] = useState<CustomerRecord[]>([]);
  const [staffs, setStaffs] = useState<StaffRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerRecord | null>(null);

  const [searchData, setSearchData] = useState<CustomerRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const staffOptions = useMemo(
    () =>
      staffs.map((item) => ({
        value: item.id,
        label: `${item.name} - ${item.id}`,
      })),
    [staffs],
  );

  const fetchUsers = useCallback(async () => {
    try {
      showLoading();

      const [customerSnapshot, staffSnapshot] = await Promise.all([
        getDocs(query(collection(db, "Users"), where("isStaff", "==", false))),
        getDocs(query(collection(db, "Users"), where("isStaff", "==", true))),
      ]);

      const customerData = customerSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as CustomerRecord[];

      const staffData = staffSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as StaffRecord[];

      setUsers(customerData);
      setStaffs(staffData);
    } catch (error) {
      console.error(error);
      toast.error("Lấy dữ liệu khách hàng thất bại");
    } finally {
      hideLoading();
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onSearch = useCallback(() => {
    const values = form.getFieldsValue();
    setIsSearching(true);

    let filteredData = [...users];

    if (values.keyword) {
      const keyword = String(values.keyword).toLowerCase().trim();

      filteredData = filteredData.filter(
        (item) =>
          item.name?.toLowerCase().includes(keyword) ||
          item.id?.toLowerCase().includes(keyword) ||
          item.phoneNumber?.toLowerCase().includes(keyword),
      );
    }

    if (values.level) {
      filteredData = filteredData.filter((item) => item.level === values.level);
    }

    if (values.status) {
      filteredData = filteredData.filter(
        (item) => item.status === values.status,
      );
    }

    if (values.dateOfBirth) {
      const targetDate = dayjs(values.dateOfBirth).format("DD/MM/YYYY");
      filteredData = filteredData.filter(
        (item) =>
          dayjs(item.dateOfBirth, "DD/MM/YYYY").format("DD/MM/YYYY") ===
          targetDate,
      );
    }

    setSearchData(filteredData);
  }, [form, users]);

  const exportToExcel = (
    data: any,
    fileName = "customers.xlsx",
    isExport: boolean,
  ) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const dataBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    if (isExport) {
      saveAs(dataBlob, fileName);
      toast.success("Xuất file thành công");
    } else {
      return new File([dataBlob], `${fileName}.xlsx`, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
  };

  const downloadTemplate = useCallback(() => {
    const template = [
      {
        name: "Nguyễn Văn A",
        address: "Hà Nội",
        branchCode: "KCG-HN01",
        dateOfBirth: "10/10/1990",
        email: "btb.customer@example.com",
        phoneNumber: "0988888888",
        level: "BTB",
        saleOwnerId: "",
        note: "Khách sỉ mới",
      },
      {
        name: "Trần Thị B",
        address: "TP.HCM",
        branchCode: "KCG-HCM01",
        dateOfBirth: "15/05/1995",
        email: "ctv.customer@example.com",
        phoneNumber: "0977777777",
        level: "CTV",
        saleOwnerId: "",
        note: "CTV khu vực HCM",
      },
    ];

    exportToExcel(template, "customer_template", true);
  }, []);

  const resetCustomerModal = useCallback(() => {
    setCustomerModalOpen(false);
    setSelectedCustomer(null);
    setCustomerModalMode("CREATE");
    customerForm.resetFields();
  }, [customerForm]);

  const openCreateCustomerModal = useCallback(() => {
    setCustomerModalMode("CREATE");
    setSelectedCustomer(null);

    customerForm.resetFields();
    customerForm.setFieldsValue({
      level: "BTB",
      status: "PENDING",
    });

    setCustomerModalOpen(true);
  }, [customerForm]);

  const openCustomerModal = useCallback(
    (record: CustomerRecord, mode: "EDIT" | "VIEW") => {
      setSelectedCustomer(record);
      setCustomerModalMode(mode);

      customerForm.resetFields();
      customerForm.setFieldsValue({
        name: record.name,
        dateOfBirth: record.dateOfBirth
          ? dayjs(record?.dateOfBirth, "DD/MM/YYYY")
          : undefined,
        email: record.email,
        phoneNumber: record.phoneNumber,
        address: record.address,
        level: record.level,
        status: record.status,
        branchCode: record.branchCode,
        saleOwnerId: record.saleOwnerId,
        note: record.note,
      });

      setCustomerModalOpen(true);
    },
    [customerForm],
  );

  const checkPhoneExists = useCallback(
    (phoneNumber: string, currentCustomerId?: string) => {
      const normalized = normalizePhone(phoneNumber);

      return users.find(
        (item) =>
          normalizePhone(item.phoneNumber) === normalized &&
          item.id !== currentCustomerId,
      );
    },
    [users],
  );

  const getStaffNameById = useCallback(
    (staffId?: string) => {
      if (!staffId) return "";
      return staffs.find((item) => item.id === staffId)?.name || "";
    },
    [staffs],
  );

  const handleSubmitCustomer = useCallback(async () => {
    try {
      const values = await customerForm.validateFields();

      const normalizedPhone = normalizePhone(values.phoneNumber);
      const existedPhone = checkPhoneExists(
        normalizedPhone,
        selectedCustomer?.id,
      );

      if (existedPhone) {
        toast.error("Số điện thoại đã tồn tại trong hệ thống");
        return;
      }

      if (values.saleOwnerId) {
        const existedStaff = staffs.find(
          (item) => item.id === values.saleOwnerId,
        );
        if (!existedStaff) {
          toast.error("Sale chăm sóc không tồn tại");
          return;
        }
      }

      const isCreate = customerModalMode === "CREATE";
      const customerId = selectedCustomer?.id || createCustomerId();

      const payload: CustomerRecord = {
        id: customerId,
        name: String(values.name || "").trim(),
        dateOfBirth: values.dateOfBirth
          ? dayjs(values.dateOfBirth).format("DD/MM/YYYY")
          : "",
        email: String(values.email || "").trim(),
        phoneNumber: normalizedPhone,
        address: String(values.address || "").trim(),
        level: values.level,
        status: isCreate ? values.status : "PENDING",
        isStaff: false,
        branchCode: String(values.branchCode || "").trim(),
        saleOwnerId: String(values.saleOwnerId || "").trim(),
        saleOwnerName: getStaffNameById(values.saleOwnerId),
        note: String(values.note || "").trim(),
        createdAt: isCreate
          ? serverTimestamp()
          : selectedCustomer?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      showLoading();

      await setDoc(doc(db, "Users", customerId), payload, { merge: true });

      toast.success(
        isCreate
          ? "Thêm mới khách hàng thành công"
          : "Cập nhật khách hàng thành công",
      );
      resetCustomerModal();
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error(
        customerModalMode === "CREATE"
          ? "Thêm mới khách hàng thất bại"
          : "Cập nhật khách hàng thất bại",
      );
    } finally {
      hideLoading();
    }
  }, [
    checkPhoneExists,
    customerForm,
    customerModalMode,
    fetchUsers,
    getStaffNameById,
    resetCustomerModal,
    selectedCustomer,
    staffs,
  ]);

  const handleApproveCustomer = useCallback(
    async (record: CustomerRecord) => {
      try {
        showLoading();

        await updateDoc(doc(db, "Users", record.id), {
          status: "ACTIVE",
          updatedAt: serverTimestamp(),
        });

        toast.success("Đã duyệt khách hàng");
        fetchUsers();
      } catch (error) {
        console.error(error);
        toast.error("Duyệt khách hàng thất bại");
      } finally {
        hideLoading();
      }
    },
    [fetchUsers],
  );

  const propsUpload: UploadProps = {
    name: "file",
    multiple: false,
    accept: ".xlsx",
    beforeUpload: (nextFile) => {
      const isExcel =
        nextFile.type === "application/vnd.ms-excel" ||
        nextFile.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (!isExcel) {
        message.error("Chỉ chấp nhận file Excel");
        return Upload.LIST_IGNORE;
      }

      const reader = new FileReader();

      reader.onload = async (e) => {
        const REQUIRED_COLUMNS = [
          "address",
          "branchCode",
          "dateOfBirth",
          "email",
          "name",
          "phoneNumber",
          "level",
        ];

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);
        const headers: string[] = (json[0] || []) as string[];

        const missing = REQUIRED_COLUMNS.filter(
          (col) =>
            !headers.some(
              (h: string) =>
                String(h || "")
                  .trim()
                  .toLowerCase() === col.toLowerCase(),
            ),
        );

        if (missing.length > 0) {
          setErrorFile(true);
          message.error("Dữ liệu không đúng định dạng");
        } else {
          message.success("Tải lên file thành công");
          setExcelData(rows);
        }
      };

      reader.readAsArrayBuffer(nextFile as File);
      setFile(nextFile as File);
      setErrorFile(false);

      return false;
    },
  };

  const onCheckFile = useCallback(async () => {
    try {
      showLoading();

      if (!file) {
        toast.error("Vui lòng chọn file");
        return;
      }

      const normalizedRows = excelData.map((item: any) => {
        const normalizedPhone = normalizePhone(item.phoneNumber);

        return {
          ...item,
          id: createCustomerId(),
          phoneNumber: normalizedPhone,
          isStaff: false,
          status: "PENDING",
          saleOwnerId: String(item.saleOwnerId || "").trim(),
          saleOwnerName: getStaffNameById(item.saleOwnerId),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      });

      const invalidLevel = normalizedRows.find(
        (item: any) =>
          !item?.level || !["CTV", "BTB"].includes(String(item.level)),
      );

      if (invalidLevel) {
        toast.error("File chỉ được chứa khách hàng CTV hoặc BTB");
        return;
      }

      const invalidPhone = normalizedRows.find(
        (item: any) =>
          !/^(0|\+84)\d{8,10}$/.test(String(item.phoneNumber || "")),
      );

      if (invalidPhone) {
        toast.error(`Số điện thoại không hợp lệ: ${invalidPhone.phoneNumber}`);
        return;
      }

      const duplicatePhoneInFile = normalizedRows.find(
        (item: any, index: number) =>
          normalizedRows.findIndex(
            (x: any) =>
              normalizePhone(x.phoneNumber) ===
              normalizePhone(item.phoneNumber),
          ) !== index,
      );

      if (duplicatePhoneInFile) {
        toast.error(
          `File có số điện thoại bị trùng: ${duplicatePhoneInFile.phoneNumber}`,
        );
        return;
      }

      const duplicatePhoneInSystem = normalizedRows.find((item: any) =>
        users.some(
          (user) =>
            normalizePhone(user.phoneNumber) ===
            normalizePhone(item.phoneNumber),
        ),
      );

      if (duplicatePhoneInSystem) {
        toast.error(
          `Số điện thoại đã tồn tại: ${duplicatePhoneInSystem.phoneNumber}`,
        );
        return;
      }

      const invalidSaleOwner = normalizedRows.find(
        (item: any) =>
          item.saleOwnerId &&
          !staffs.some((staff) => staff.id === item.saleOwnerId),
      );

      if (invalidSaleOwner) {
        toast.error(
          `Sale chăm sóc không tồn tại: ${invalidSaleOwner.saleOwnerId}`,
        );
        return;
      }

      let successCount = 0;

      for (const user of normalizedRows) {
        await setDoc(doc(db, "Users", user.id), user, { merge: true });
        successCount++;
      }

      toast.success(`Upload thành công ${successCount} khách hàng`);
      fetchUsers();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload thất bại");
    } finally {
      hideLoading();
      setOpenExcelModal(false);
      setFile(null);
      setExcelData([]);
      setErrorFile(false);
    }
  }, [excelData, file, fetchUsers, getStaffNameById, staffs, users]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 180,
    },
    {
      title: "Họ và tên",
      dataIndex: "name",
      width: 180,
    },
    {
      title: "Sinh nhật",
      dataIndex: "dateOfBirth",
      width: 120,
    },
    {
      title: "Email",
      dataIndex: "email",
      width: 220,
    },
    {
      title: "Số điện thoại",
      dataIndex: "phoneNumber",
      width: 140,
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
      width: 220,
    },
    {
      title: "Loại khách hàng",
      dataIndex: "level",
      width: 140,
      render: (value: any) => (
        <div>{LEVEL_CUSTOMER?.[value as keyof typeof LEVEL_CUSTOMER]}</div>
      ),
    },
    {
      title: "Sale chăm sóc",
      dataIndex: "saleOwnerName",
      width: 180,
      render: (_: any, record: CustomerRecord) =>
        record.saleOwnerName || getStaffNameById(record.saleOwnerId) || "--",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 120,
      render: (value: any) => {
        const status = STATUS_CUSTOMER?.[value as keyof typeof STATUS_CUSTOMER];
        return (
          <Tag color={STATUS_COLOR[value as keyof typeof STATUS_COLOR]}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      fixed: "right" as const,
      width: 150,
      render: (_: any, record: CustomerRecord) => {
        return (
          <div className="flex flex-row items-center">
            <Button
              type="text"
              icon={<EyeOutlined className="text-link-500" />}
              onClick={() => openCustomerModal(record, "VIEW")}
            />
            <Button
              type="text"
              className="ml-8"
              icon={<EditFilled className="text-link-500" />}
              onClick={() => openCustomerModal(record, "EDIT")}
            />
            {record?.status === "PENDING" && (
              <Button
                type="text"
                className="ml-8"
                icon={<CheckOutlined className="text-link-500" />}
                onClick={() => handleApproveCustomer(record)}
              />
            )}
          </div>
        );
      },
    },
  ];

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  return (
    <div className="block-content">
      <Card title="Danh sách khách hàng">
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
          onFinish={() => undefined}
        >
          <Row gutter={24}>
            <Col span={6}>
              <Form.Item name="keyword" label="Tìm kiếm">
                <Input
                  className="h-40"
                  placeholder="Tìm kiếm theo ID, tên, số điện thoại"
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item name="level" label="Loại khách hàng">
                <Select
                  size="large"
                  allowClear
                  placeholder="Chọn loại khách hàng"
                  options={CUSTOMER_LEVEL_OPTIONS}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  size="large"
                  allowClear
                  placeholder="Chọn trạng thái"
                  options={CUSTOMER_STATUS_OPTIONS}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item
                name="dateOfBirth"
                label="DOB"
                rules={[
                  () => ({
                    validator(_, value) {
                      if (value && dayjs(value).isAfter(dayjs(), "day")) {
                        return Promise.reject(
                          new Error("Vui lòng chọn lại ngày sinh!"),
                        );
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <MyDatePicker
                  placeholder="DD/MM/YYYY"
                  className="h-40 w-full"
                  format="DD/MM/YYYY"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row>
            <Form.Item>
              <Button onClick={onSearch} type="primary" className="h-40">
                Tìm kiếm
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={() => {
                  form.resetFields();
                  setIsSearching(false);
                }}
                icon={<ReloadOutlined />}
                className="h-40"
                type="default"
              >
                Reset
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={openCreateCustomerModal}
                icon={<PlusOutlined />}
                className="h-40"
                type="primary"
              >
                Thêm mới khách hàng
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={() => setOpenExcelModal(true)}
                icon={<ExportOutlined />}
                className="h-40"
                type="default"
              >
                Tải danh sách khách hàng
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={downloadTemplate}
                icon={<DownloadOutlined />}
                className="h-40"
                type="default"
              >
                Tải FILE mẫu
              </Button>
            </Form.Item>
          </Row>
        </Form>

        <Table
          rowKey="id"
          bordered
          dataSource={isSearching ? searchData : users}
          columns={columns}
          scroll={{ y: 500, x: 1700 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Tổng ${total} khách hàng`,
            onChange: (page, pageSize) => {
              setPagination({
                current: page,
                pageSize: pageSize || 10,
              });
            },
          }}
        />

        <Modal
          open={openExcelModal}
          title="Thêm mới danh sách khách hàng"
          onCancel={() => {
            setOpenExcelModal(false);
            setFile(null);
            setExcelData([]);
            setErrorFile(false);
          }}
          width={1000}
          footer={null}
        >
          <Dragger
            {...propsUpload}
            fileList={file ? [file as any] : []}
            onRemove={() => {
              setFile(null);
              setExcelData([]);
              setErrorFile(false);
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Nhấn hoặc thả file vào đây để tải lên
            </p>
            <p className="ant-upload-hint">
              Hỗ trợ tải lên từng file, đúng định dạng mẫu.
            </p>
          </Dragger>

          {errorFile ? (
            <div className="text-error-500 mt-8">
              Vui lòng chọn đúng file mẫu.
            </div>
          ) : null}

          <Row justify="end" className="mt-16">
            <Button
              type="primary"
              disabled={!file || errorFile}
              className="h-40"
              onClick={onCheckFile}
            >
              Tải lên
            </Button>
            <Button
              onClick={() => {
                setFile(null);
                setExcelData([]);
                setErrorFile(false);
                setOpenExcelModal(false);
              }}
              type="default"
              className="ml-16 h-40"
            >
              Huỷ
            </Button>
          </Row>
        </Modal>

        <Modal
          open={customerModalOpen}
          title={
            customerModalMode === "CREATE"
              ? "Thêm mới khách hàng"
              : customerModalMode === "EDIT"
                ? "Chỉnh sửa khách hàng"
                : "Chi tiết khách hàng"
          }
          onCancel={resetCustomerModal}
          width={900}
          footer={null}
          destroyOnClose
        >
          {customerModalMode === "VIEW" ? (
            <>
              {selectedCustomer ? (
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="ID">
                    {selectedCustomer.id}
                  </Descriptions.Item>
                  <Descriptions.Item label="Họ tên">
                    {selectedCustomer.name || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Số điện thoại">
                    {selectedCustomer.phoneNumber || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Email">
                    {selectedCustomer.email || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày sinh">
                    {selectedCustomer.dateOfBirth || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Loại khách">
                    {LEVEL_CUSTOMER?.[
                      selectedCustomer.level as keyof typeof LEVEL_CUSTOMER
                    ] || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    <Tag
                      color={
                        STATUS_COLOR[
                          selectedCustomer.status as keyof typeof STATUS_COLOR
                        ]
                      }
                    >
                      {
                        STATUS_CUSTOMER?.[
                          selectedCustomer.status as keyof typeof STATUS_CUSTOMER
                        ]
                      }
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Sale chăm sóc">
                    {selectedCustomer.saleOwnerName ||
                      getStaffNameById(selectedCustomer.saleOwnerId) ||
                      "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Chi nhánh">
                    {selectedCustomer.branchCode || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ" span={2}>
                    {selectedCustomer.address || "--"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {selectedCustomer.note || "--"}
                  </Descriptions.Item>
                </Descriptions>
              ) : null}

              <Row justify="end" className="mt-16">
                <Button className="h-40" onClick={resetCustomerModal}>
                  Đóng
                </Button>
              </Row>
            </>
          ) : (
            <Form form={customerForm} layout="vertical" autoComplete="off">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="name"
                    label="Họ và tên"
                    rules={[
                      { required: true, message: "Vui lòng nhập họ tên" },
                      { min: 2, message: "Họ tên tối thiểu 2 ký tự" },
                      { max: 120, message: "Họ tên tối đa 120 ký tự" },
                      {
                        validator: (_, value) => {
                          if (!value || String(value).trim())
                            return Promise.resolve();
                          return Promise.reject(
                            new Error("Họ tên không hợp lệ"),
                          );
                        },
                      },
                    ]}
                  >
                    <Input
                      className="h-40"
                      placeholder="Nhập họ tên khách hàng"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="phoneNumber"
                    label="Số điện thoại"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập số điện thoại",
                      },
                      {
                        validator: (_, value) => {
                          const normalized = normalizePhone(value);
                          if (!normalized) {
                            return Promise.reject(
                              new Error("Vui lòng nhập số điện thoại"),
                            );
                          }

                          if (!/^(0|\+84)\d{8,10}$/.test(normalized)) {
                            return Promise.reject(
                              new Error("Số điện thoại không hợp lệ"),
                            );
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input className="h-40" placeholder="Nhập số điện thoại" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { type: "email", message: "Email không hợp lệ" },
                      { max: 150, message: "Email tối đa 150 ký tự" },
                    ]}
                  >
                    <Input className="h-40" placeholder="Nhập email" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="dateOfBirth"
                    label="Ngày sinh"
                    rules={[
                      () => ({
                        validator(_, value) {
                          if (value && dayjs(value).isAfter(dayjs(), "day")) {
                            return Promise.reject(
                              new Error("Ngày sinh không hợp lệ"),
                            );
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <MyDatePicker
                      placeholder="DD/MM/YYYY"
                      className="h-40 w-full"
                      format="DD/MM/YYYY"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="level"
                    label="Loại khách hàng"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn loại khách hàng",
                      },
                    ]}
                  >
                    <Select
                      size="large"
                      options={CUSTOMER_LEVEL_OPTIONS}
                      placeholder="Chọn loại khách hàng"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="status"
                    label="Trạng thái"
                    rules={[
                      { required: true, message: "Vui lòng chọn trạng thái" },
                    ]}
                  >
                    <Select
                      size="large"
                      options={CUSTOMER_STATUS_OPTIONS}
                      placeholder="Chọn trạng thái"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="branchCode"
                    label="Mã chi nhánh"
                    rules={[
                      { max: 50, message: "Mã chi nhánh tối đa 50 ký tự" },
                    ]}
                  >
                    <Input className="h-40" placeholder="Nhập mã chi nhánh" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="saleOwnerId"
                    label="Sale chăm sóc"
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          const existedStaff = staffs.find(
                            (item) => item.id === value,
                          );
                          if (!existedStaff) {
                            return Promise.reject(
                              new Error("Sale chăm sóc không tồn tại"),
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Select
                      size="large"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={staffOptions}
                      placeholder="Chọn nhân viên sale chăm sóc"
                    />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    name="address"
                    label="Địa chỉ"
                    rules={[{ max: 300, message: "Địa chỉ tối đa 300 ký tự" }]}
                  >
                    <Input.TextArea rows={3} placeholder="Nhập địa chỉ" />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    name="note"
                    label="Ghi chú"
                    rules={[{ max: 500, message: "Ghi chú tối đa 500 ký tự" }]}
                  >
                    <Input.TextArea rows={3} placeholder="Nhập ghi chú" />
                  </Form.Item>
                </Col>
              </Row>

              <Row justify="end" className="mt-16">
                <Button className="h-40" onClick={resetCustomerModal}>
                  Huỷ
                </Button>
                <Button
                  type="primary"
                  className="ml-16 h-40"
                  onClick={handleSubmitCustomer}
                >
                  {customerModalMode === "CREATE" ? "Thêm mới" : "Cập nhật"}
                </Button>
              </Row>
            </Form>
          )}
        </Modal>
      </Card>
    </div>
  );
};

const ManageCustomer = memo(Component);

export { ManageCustomer };

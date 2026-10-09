import {
  Button,
  Card,
  Col,
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
import { hideLoading, showLoading } from "../loading";
import { toast } from "react-toastify";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { STATUS_COLOR, STATUS_CUSTOMER } from "@/constant";

const normalizeText = (value: any) => String(value || "").trim();

const normalizeMultiValue = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractCategoryOptions = (categories: any[]) => {
  const map = new Map<string, { label: string; value: string }>();

  categories.forEach((item) => {
    const parentValue = normalizeText(item?.data || item?.id);
    const parentLabel = normalizeText(item?.name || item?.data || item?.id);

    if (parentValue) {
      map.set(parentValue, {
        label: parentLabel,
        value: parentValue,
      });
    }

    if (Array.isArray(item?.categories)) {
      item.categories.forEach((child: any) => {
        if (typeof child === "string") {
          const value = normalizeText(child);
          if (value) {
            map.set(value, {
              label: value,
              value,
            });
          }
          return;
        }

        const value = normalizeText(child?.id || child?.data);
        const label = normalizeText(child?.name || child?.data || child?.id);

        if (value) {
          map.set(value, {
            label: label || value,
            value,
          });
        }
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "vi"),
  );
};

const DEFAULT_PROVIDER_FORM = {
  id: "",
  contractName: "",
  email: "",
  phoneNumber: "",
  address: "",
  branchCode: undefined,
  category: [],
  status: "PENDING",
};

const Component = () => {
  const [form] = Form.useForm();
  const [providerForm] = Form.useForm();

  const [file, setFile] = useState<File | null>(null);
  const [errorFile, setErrorFile] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [provider, setProvider] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [searchData, setSearchData] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerModalMode, setProviderModalMode] = useState<
    "CREATE" | "VIEW" | "EDIT"
  >("CREATE");
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  const categoryOptions = useMemo(
    () => extractCategoryOptions(categories),
    [categories],
  );

  const branchOptions = useMemo(
    () => [
      { label: "Hà Nội", value: "HN" },
      { label: "Hưng Yên", value: "HY" },
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { label: "Chờ phê duyệt", value: "PENDING" },
      { label: "Đang hợp tác", value: "ACTIVE" },
      { label: "Ngừng hợp tác", value: "INACTIVE" },
    ],
    [],
  );

  const isViewMode = providerModalMode === "VIEW";
  const isCreateMode = providerModalMode === "CREATE";
  const isEditMode = providerModalMode === "EDIT";

  const fetchProvider = useCallback(async () => {
    try {
      showLoading();

      const q = collection(db, "Provider");
      const querySnapshot = await getDocs(q);

      const data = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setProvider(data);
    } catch (error) {
      console.error(error);
      toast.error("Lấy dữ liệu Nhà cung cấp thất bại");
    } finally {
      hideLoading();
    }
  }, []);

  const fetchCategory = useCallback(async () => {
    try {
      const q = collection(db, "Category");
      const querySnapshot = await getDocs(q);

      const data = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setCategories(data);
    } catch (error) {
      console.error(error);
      toast.error("Lấy dữ liệu danh mục thất bại");
    }
  }, []);

  const onSearch = useCallback(() => {
    const values = form.getFieldsValue();

    setIsSearching(true);

    let filteredData = [...provider];

    if (values.keyword) {
      const keyword = String(values.keyword || "").toLowerCase();
      filteredData = filteredData.filter(
        (item) =>
          item.contractName?.toLowerCase().includes(keyword) ||
          item.id?.toLowerCase().includes(keyword) ||
          item.phoneNumber?.toLowerCase().includes(keyword),
      );
    }

    if (values.category?.length) {
      filteredData = filteredData.filter((item) => {
        const providerTypes = normalizeMultiValue(
          item.provideTypes?.length ? item.provideTypes : item.provideType,
        );

        return values.category.some((category: string) =>
          providerTypes.includes(category),
        );
      });
    }

    if (values.branchCode) {
      filteredData = filteredData.filter(
        (item) =>
          String(item.branchCode || "") === String(values.branchCode || ""),
      );
    }

    setSearchData(filteredData);
  }, [form, provider]);

  useEffect(() => {
    fetchProvider();
    fetchCategory();
  }, [fetchProvider, fetchCategory]);

  const openCreateProviderModal = useCallback(() => {
    setProviderModalMode("CREATE");
    setSelectedProvider(null);
    providerForm.resetFields();
    providerForm.setFieldsValue(DEFAULT_PROVIDER_FORM);
    setProviderModalOpen(true);
  }, [providerForm]);

  const openViewProviderModal = useCallback(
    (record: any) => {
      const categoriesValue = normalizeMultiValue(
        record?.provideTypes?.length ? record.provideTypes : record.provideType,
      );

      setProviderModalMode("VIEW");
      setSelectedProvider(record);
      providerForm.resetFields();
      providerForm.setFieldsValue({
        id: record?.id || "",
        contractName: record?.contractName || "",
        email: record?.email || "",
        phoneNumber: record?.phoneNumber || "",
        address: record?.address || "",
        branchCode: record?.branchCode || undefined,
        category: categoriesValue,
        status: record?.status || "PENDING",
      });
      setProviderModalOpen(true);
    },
    [providerForm],
  );

  const openEditProviderModal = useCallback(
    (record: any) => {
      const categoriesValue = normalizeMultiValue(
        record?.provideTypes?.length ? record.provideTypes : record.provideType,
      );

      setProviderModalMode("EDIT");
      setSelectedProvider(record);
      providerForm.resetFields();
      providerForm.setFieldsValue({
        id: record?.id || "",
        contractName: record?.contractName || "",
        email: record?.email || "",
        phoneNumber: record?.phoneNumber || "",
        address: record?.address || "",
        branchCode: record?.branchCode || undefined,
        category: categoriesValue,
        status: record?.status || "PENDING",
      });
      setProviderModalOpen(true);
    },
    [providerForm],
  );

  const closeProviderModal = useCallback(() => {
    setProviderModalOpen(false);
    setSelectedProvider(null);
    providerForm.resetFields();
  }, [providerForm]);

  const handleSaveProvider = useCallback(async () => {
    try {
      const values = await providerForm.validateFields();
      setSavingProvider(true);

      const provideTypes = normalizeMultiValue(values.category);

      const payload = {
        id: normalizeText(values.id),
        contractName: normalizeText(values.contractName),
        email: normalizeText(values.email),
        phoneNumber: normalizeText(values.phoneNumber),
        address: normalizeText(values.address),
        branchCode: normalizeText(values.branchCode),
        provideType: provideTypes[0] || "",
        provideTypes,
        status: isCreateMode
          ? "PENDING"
          : normalizeText(values.status || "PENDING"),
        updatedAt: serverTimestamp(),
      };

      if (!payload.id) {
        toast.error("Vui lòng nhập ID Nhà cung cấp");
        return;
      }

      if (isCreateMode) {
        await setDoc(doc(db, "Provider", payload.id), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Thêm mới Nhà cung cấp thành công");
      } else {
        await updateDoc(doc(db, "Provider", payload.id), payload);
        toast.success("Cập nhật Nhà cung cấp thành công");
      }

      closeProviderModal();
      await fetchProvider();
    } catch (error) {
      console.error(error);
      if ((error as any)?.errorFields) return;
      toast.error("Lưu Nhà cung cấp thất bại");
    } finally {
      setSavingProvider(false);
    }
  }, [closeProviderModal, fetchProvider, isCreateMode, providerForm]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 160,
    },
    {
      title: "Người liên hệ",
      dataIndex: "contractName",
    },
    {
      title: "Email",
      dataIndex: "email",
    },
    {
      title: "Số điện thoại",
      dataIndex: "phoneNumber",
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
    },
    {
      title: "Danh mục cung cấp",
      dataIndex: "provideType",
      render: (_: any, record: any) => {
        const values = normalizeMultiValue(
          record.provideTypes?.length
            ? record.provideTypes
            : record.provideType,
        );
        return values.length ? values.join(", ") : "";
      },
    },
    {
      title: "Khu vực",
      dataIndex: "branchCode",
    },
    {
      title: "Trạng thái hợp tác",
      dataIndex: "status",
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
      render: (_: any, record: any) => {
        return (
          <div className="flex flex-row items-center">
            <Button
              type="text"
              icon={<EyeOutlined className="text-link-500" />}
              onClick={() => openViewProviderModal(record)}
            />
            <Button
              type="text"
              className="ml-16"
              icon={<EditFilled className="text-link-500" />}
              onClick={() => openEditProviderModal(record)}
            />
            {record?.status === "PENDING" && (
              <Button
                type="text"
                className="ml-16"
                icon={<CheckOutlined className="text-link-500" />}
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "Provider", record.id), {
                      status: "ACTIVE",
                      updatedAt: serverTimestamp(),
                    });
                    toast.success("Phê duyệt Nhà cung cấp thành công");
                    await fetchProvider();
                  } catch (error) {
                    console.error(error);
                    toast.error("Phê duyệt thất bại");
                  }
                }}
              />
            )}
          </div>
        );
      },
    },
  ];

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
          "id",
          "address",
          "branchCode",
          "provideType",
          "email",
          "contractName",
          "phoneNumber",
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
          message.success("Tải lên File thành công");
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

      const data = excelData.map((item: any) => {
        const provideTypes = normalizeMultiValue(
          item.provideTypes || item.provideType,
        );

        return {
          ...item,
          id: String(item.id),
          phoneNumber: String(item.phoneNumber ?? ""),
          provideType: provideTypes[0] || "",
          provideTypes,
          status: "PENDING",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      });

      const providerRef = collection(db, "Provider");
      let successCount = 0;

      for (const providerItem of data) {
        if (!providerItem?.id) {
          console.error("Thiếu id:", providerItem);
          continue;
        }

        await setDoc(doc(providerRef, providerItem.id), providerItem, {
          merge: true,
        });
        successCount++;
      }

      toast.success(`Upload thành công ${successCount} Nhà cung cấp`);
      await fetchProvider();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload thất bại");
    } finally {
      hideLoading();
      setOpenModal(false);
    }
  }, [excelData, file, fetchProvider]);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  return (
    <div className="block-content">
      <Card title="Danh sách Nhà cung cấp">
        <Form
          form={form}
          name="validateOnly"
          layout="vertical"
          autoComplete="off"
          onFinish={() => {}}
        >
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="keyword" label="Tìm kiếm">
                <Input
                  className="h-40"
                  placeholder="Tìm kiếm theo ID, tên liên hệ, số điện thoại"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label="Danh mục" name="category">
                <Select
                  mode="multiple"
                  size="large"
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  options={categoryOptions}
                  notFoundContent={null}
                  placeholder="Chọn một hoặc nhiều danh mục"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label="Khu vực" name="branchCode">
                <Select
                  size="large"
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  options={branchOptions}
                  notFoundContent={null}
                  placeholder="Chọn khu vực"
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
                onClick={openCreateProviderModal}
                icon={<PlusOutlined />}
                className="h-40"
                type="primary"
              >
                Thêm mới Nhà cung cấp
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={() => setOpenModal(true)}
                icon={<ExportOutlined />}
                className="h-40"
                type="primary"
              >
                Tải danh sách Nhà cung cấp
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={() => {}}
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
          dataSource={isSearching ? searchData : provider}
          columns={columns}
          scroll={{ y: 500, x: 150 * columns.length }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Tổng ${total} Nhà cung cấp`,
            onChange: (page, pageSize) => {
              setPagination({
                current: page,
                pageSize: pageSize || 10,
              });
            },
          }}
        />

        <Modal
          open={openModal}
          title="Thêm mới danh sách Nhà cung cấp"
          onCancel={() => setOpenModal(false)}
          width={1000}
          footer={null}
        >
          <Dragger
            {...propsUpload}
            fileList={file ? [file as any] : []}
            onRemove={() => setFile(null)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              Nhấn hoặc thả file vào đây để tải lên
            </p>
            <p className="ant-upload-hint">
              Hỗ trợ tải lên từng file, dung lượng không vượt quá 2MB và 10,000
              số tài khoản.
            </p>
          </Dragger>

          {errorFile ? (
            <div className="text-error-500">
              Vui lòng chọn đúng định dạng file.
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
                setErrorFile(false);
                setOpenModal(false);
              }}
              type="default"
              className="ml-16 h-40"
            >
              Huỷ
            </Button>
          </Row>
        </Modal>

        <Modal
          open={providerModalOpen}
          title={
            isCreateMode
              ? "Thêm mới Nhà cung cấp"
              : isEditMode
                ? "Chỉnh sửa Nhà cung cấp"
                : "Chi tiết Nhà cung cấp"
          }
          onCancel={closeProviderModal}
          width={900}
          footer={null}
          destroyOnClose
        >
          <Form
            form={providerForm}
            layout="vertical"
            autoComplete="off"
            initialValues={DEFAULT_PROVIDER_FORM}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="ID"
                  name="id"
                  rules={[{ required: true, message: "Vui lòng nhập ID" }]}
                >
                  <Input
                    disabled={isViewMode || isEditMode}
                    placeholder="Nhập ID Nhà cung cấp"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Người liên hệ"
                  name="contractName"
                  rules={[
                    { required: true, message: "Vui lòng nhập người liên hệ" },
                  ]}
                >
                  <Input
                    disabled={isViewMode}
                    placeholder="Nhập tên người liên hệ"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: "Vui lòng nhập email" },
                    { type: "email", message: "Email không đúng định dạng" },
                  ]}
                >
                  <Input disabled={isViewMode} placeholder="Nhập email" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Số điện thoại"
                  name="phoneNumber"
                  rules={[
                    { required: true, message: "Vui lòng nhập số điện thoại" },
                  ]}
                >
                  <Input
                    disabled={isViewMode}
                    placeholder="Nhập số điện thoại"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Khu vực"
                  name="branchCode"
                  rules={[{ required: true, message: "Vui lòng chọn khu vực" }]}
                >
                  <Select
                    disabled={isViewMode}
                    options={branchOptions}
                    placeholder="Chọn khu vực"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Danh mục cung cấp"
                  name="category"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng chọn ít nhất 1 danh mục",
                    },
                  ]}
                >
                  <Select
                    mode="multiple"
                    disabled={isViewMode}
                    options={categoryOptions}
                    placeholder="Chọn danh mục cung cấp"
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item
                  label="Địa chỉ"
                  name="address"
                  rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}
                >
                  <Input
                    disabled={isViewMode}
                    placeholder="Nhập địa chỉ Nhà cung cấp"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Trạng thái hợp tác" name="status">
                  <Select
                    disabled={isViewMode || isCreateMode}
                    options={statusOptions}
                    placeholder="Chọn trạng thái"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row justify="end" className="mt-16">
              <Button onClick={closeProviderModal} className="h-40">
                {isViewMode ? "Đóng" : "Huỷ"}
              </Button>

              {!isViewMode ? (
                <Button
                  type="primary"
                  className="ml-16 h-40"
                  loading={savingProvider}
                  onClick={handleSaveProvider}
                >
                  {isCreateMode ? "Thêm mới" : "Lưu cập nhật"}
                </Button>
              ) : null}
            </Row>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

const ManageProvider = memo(Component);

export { ManageProvider };

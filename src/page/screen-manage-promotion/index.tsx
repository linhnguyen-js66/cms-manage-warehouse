import { useForm } from "antd/es/form/Form";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { PlusCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import MyDatePicker from "@/components/basic/date-picker";
import { hideLoading, showLoading } from "../loading";

const Component = () => {
  const [form] = useForm();
  const [formPromo] = useForm();

  const navigate = useNavigate();

  const [visible, setIsVisible] = useState(false);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const [mode, setMode] = useState<"detail" | "edit">("detail");

  const getPromotionStatus = useCallback((item: any) => {
    if (item?.status === "DISABLED") return "DISABLED";

    const now = dayjs();
    const startDate = item?.startDate ? dayjs(item.startDate) : null;
    const expiredDate = item?.expiredDate ? dayjs(item.expiredDate) : null;

    if (!startDate || !startDate.isValid()) return "UPCOMING";
    if (!expiredDate || !expiredDate.isValid()) return "UPCOMING";

    if (now.isBefore(startDate)) return "UPCOMING";
    if (now.isAfter(expiredDate)) return "EXPIRED";
    return "ONGOING";
  }, []);

  const getEffectiveness = useCallback((item: any) => {
    const totalAmount = Number(item?.totalAmount || 0);
    const totalSale = Number(item?.totalSale || 0);

    console.log(totalAmount, 'check======')
    if (!totalAmount) return "LOW-EFFECTIVE";

    const rate = (item?.totalRevenue/totalSale) //(totalSale / totalAmount) * 100;
    console.log(rate)

    if (rate >= 50) return "HIGH-EFFECTIVE";
    if (rate >= 20) return "NORMAL-EFFECTIVE";
    return "LOW-EFFECTIVE";
  }, []);

  const fetchPromotions = useCallback(async () => {
    try {
      showLoading();

      const querySnapshot = await getDocs(collection(db, "Promotions"));
      const rawData = querySnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      const updatedData = await Promise.all(
        rawData.map(async (item: any) => {
          const computedStatus = getPromotionStatus(item);
          const effectiveness = getEffectiveness(item);

          const currentStatus = item?.status;

          if (
            currentStatus !== "DISABLED" &&
            currentStatus !== computedStatus
          ) {
            await updateDoc(doc(db, "Promotions", item.id), {
              status: computedStatus,
              updatedAt: dayjs().toISOString(),
            });
          }

          return {
            ...item,
            status: currentStatus === "DISABLED" ? "DISABLED" : computedStatus,
            computedStatus:
              currentStatus === "DISABLED" ? "DISABLED" : computedStatus,
            effectiveness,
          };
        }),
      );

      setPromotions(updatedData);
      setFilteredData(updatedData);
    } catch (error) {
      console.error(error);
      toast.error("Lấy danh sách khuyến mãi thất bại");
    } finally {
      hideLoading();
    }
  }, [getEffectiveness, getPromotionStatus]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const onSearch = useCallback(() => {
    const values = form.getFieldsValue();

    let result = [...promotions];

    if (values.keyword) {
      const keyword = values.keyword.toLowerCase().trim();
      result = result.filter((item) =>
        item?.name?.toLowerCase()?.includes(keyword),
      );
    }

    if (values.status) {
      result = result.filter((item) => item.computedStatus === values.status);
    }

    if (values.effective) {
      result = result.filter((item) => item.effectiveness === values.effective);
    }

    setFilteredData(result);
  }, [form, promotions]);

  const onReset = useCallback(() => {
    form.resetFields();
    setFilteredData(promotions);
  }, [form, promotions]);

  const openDetailModal = useCallback(
    (record: any) => {
      setMode("detail");
      setSelectedPromotion(record);
      formPromo.resetFields();
      setIsVisible(true);
    },
    [formPromo],
  );

  const openEditModal = useCallback(
    (record: any) => {
      setMode("edit");
      setSelectedPromotion(record);

      formPromo.setFieldsValue({
        startDate: record?.startDate ? dayjs(record.startDate) : undefined,
        expiredDate: record?.expiredDate
          ? dayjs(record.expiredDate)
          : undefined,
      });

      setIsVisible(true);
    },
    [formPromo],
  );

  const handleUpdateDate = async () => {
    try {
      const values = await formPromo.validateFields();

      if (!selectedPromotion?.id) return;

      const startDate = dayjs(values.startDate);
      const expiredDate = dayjs(values.expiredDate);

      let nextStatus = "ONGOING";
      const now = dayjs();

      if (selectedPromotion?.status === "DISABLED") {
        nextStatus = "DISABLED";
      } else if (now.isBefore(startDate)) {
        nextStatus = "UPCOMING";
      } else if (now.isAfter(expiredDate)) {
        nextStatus = "EXPIRED";
      }

      showLoading();

      await updateDoc(doc(db, "Promotions", selectedPromotion.id), {
        startDate: startDate.toISOString(),
        expiredDate: expiredDate.toISOString(),
        status: nextStatus,
        updatedAt: dayjs().toISOString(),
      });

      toast.success("Cập nhật chương trình khuyến mãi thành công");
      setIsVisible(false);
      setSelectedPromotion(null);
      await fetchPromotions();
    } catch (error) {
      console.error(error);
      toast.error("Cập nhật chương trình khuyến mãi thất bại");
    } finally {
      hideLoading();
    }
  };

  const handleDisablePromotion = async (record: any) => {
    try {
      showLoading();

      await updateDoc(doc(db, "Promotions", record.id), {
        status: "DISABLED",
        updatedAt: dayjs().toISOString(),
      });

      toast.success("Đã vô hiệu hoá chương trình khuyến mãi");
      await fetchPromotions();
    } catch (error) {
      console.error(error);
      toast.error("Vô hiệu hoá chương trình thất bại");
    } finally {
      hideLoading();
    }
  };

  const renderStatusTag = (status: string) => {
    if (status === "ONGOING") return <Tag color="green">Đang diễn ra</Tag>;
    if (status === "UPCOMING") return <Tag color="blue">Sắp tới</Tag>;
    if (status === "EXPIRED") return <Tag color="red">Đã kết thúc</Tag>;
    if (status === "DISABLED") return <Tag color="default">Vô hiệu hoá</Tag>;
    return <Tag>Không xác định</Tag>;
  };

  const renderEffectiveTag = (effective: string) => {
    if (effective === "HIGH-EFFECTIVE")
      return <Tag color="green">Hiệu suất cao</Tag>;
    if (effective === "NORMAL-EFFECTIVE")
      return <Tag color="gold">Hiệu suất trung bình</Tag>;
    return <Tag color="red">Hiệu suất thấp</Tag>;
  };

  const columns = useMemo(
    () => [
      {
        title: "Tên chương trình",
        dataIndex: "name",
        width: 250,
      },
      {
        title: "Loại",
        dataIndex: "scope",
        render: (value: string) => {
          if (value === "CUSTOMER") return "Theo khách hàng";
          if (value === "CART") return "Theo đơn hàng";
          if (value === "PRODUCT") return "Theo sản phẩm";
          return value;
        },
      },
      {
        title: "Giảm giá theo",
        dataIndex: "discountType",
        render: (value: string) =>
          value === "percent" ? "Phần trăm (%)" : "Số tiền (VNĐ)",
      },
      {
        title: "Bắt đầu",
        dataIndex: "startDate",
        render: (value: string) =>
          value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "",
      },
      {
        title: "Kết thúc",
        dataIndex: "expiredDate",
        render: (value: string) =>
          value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "",
      },
      {
        title: "Tổng số lượng",
        dataIndex: "totalAmount",
      },
      {
        title: "Doanh thu",
        dataIndex: "totalRevenue",
        render: (value: number) =>
          Number(value || 0).toLocaleString("vi-VN") + " ₫",
      },
      {
        title: "Trạng thái",
        dataIndex: "computedStatus",
        render: (value: string) => renderStatusTag(value),
      },
      {
        title: "Hiệu suất",
        dataIndex: "effectiveness",
        render: (value: string) => renderEffectiveTag(value),
      },
      {
        title: "Thao tác",
        width: 260,
        render: (_: any, record: any) => (
          <Space>
            <Button onClick={() => openDetailModal(record)}>Chi tiết</Button>
            <Button type="primary" onClick={() => openEditModal(record)}>
              Sửa ngày
            </Button>
            <Popconfirm
              title="Bạn có chắc muốn vô hiệu hoá chương trình này?"
              okText="Đồng ý"
              cancelText="Huỷ"
              onConfirm={() => handleDisablePromotion(record)}
              disabled={record?.computedStatus === "DISABLED"}
            >
              <Button danger disabled={record?.computedStatus === "DISABLED"}>
                Vô hiệu hoá
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [openDetailModal, openEditModal],
  );

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  return (
    <div className="block-content">
      <Card title="Danh sách khuyến mãi">
        <Form
          form={form}
          name="searchPromotion"
          layout="vertical"
          autoComplete="off"
          onFinish={onSearch}
        >
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="keyword" label="Tìm kiếm">
                <Input
                  className="h-40"
                  placeholder="Tìm kiếm theo tên khuyến mãi"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label="Trạng thái" name="status">
                <Select
                  size="large"
                  allowClear
                  optionFilterProp="label"
                  options={[
                    { value: "ONGOING", label: "Đang diễn ra" },
                    { value: "UPCOMING", label: "Sắp tới" },
                    { value: "EXPIRED", label: "Đã kết thúc" },
                    { value: "DISABLED", label: "Vô hiệu hoá" },
                  ]}
                  placeholder="Chọn trạng thái"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label="Hiệu suất" name="effective">
                <Select
                  size="large"
                  allowClear
                  optionFilterProp="label"
                  options={[
                    { value: "HIGH-EFFECTIVE", label: "Hiệu suất cao" },
                    {
                      value: "NORMAL-EFFECTIVE",
                      label: "Hiệu suất trung bình",
                    },
                    { value: "LOW-EFFECTIVE", label: "Hiệu suất thấp" },
                  ]}
                  placeholder="Chọn hiệu suất"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row>
            <Form.Item>
              <Button htmlType="submit" type="primary" className="h-40">
                Tìm kiếm
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={onReset}
                icon={<ReloadOutlined />}
                className="h-40"
                type="default"
              >
                Reset
              </Button>
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={() => navigate("/promotion/add-promotion")}
                icon={<PlusCircleOutlined />}
                className="h-40"
                type="primary"
              >
                Thêm mới
              </Button>
            </Form.Item>
          </Row>
        </Form>

        <Table
          className="mt-16"
          rowKey="id"
          bordered
          dataSource={filteredData}
          columns={columns as any}
          scroll={{ x: 1400 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Tổng ${total} khuyến mãi`,
            onChange: (page, pageSize) => {
              setPagination({
                current: page,
                pageSize: pageSize || 10,
              });
            },
          }}
        />
      </Card>

      <Modal
        title={
          mode === "detail"
            ? "Chi tiết khuyến mãi"
            : "Cập nhật thời gian khuyến mãi"
        }
        open={visible}
        width={1000}
        footer={null}
        onCancel={() => {
          setIsVisible(false);
          setSelectedPromotion(null);
          formPromo.resetFields();
        }}
      >
        {mode === "detail" && selectedPromotion ? (
          <>
            <Descriptions bordered column={2} size="middle">
              <Descriptions.Item label="Tên chương trình">
                {selectedPromotion?.name}
              </Descriptions.Item>

              <Descriptions.Item label="Loại khuyến mãi">
                {selectedPromotion?.scope === "CUSTOMER"
                  ? "Theo khách hàng"
                  : selectedPromotion?.scope === "CART"
                    ? "Theo đơn hàng"
                    : "Theo sản phẩm"}
              </Descriptions.Item>

              <Descriptions.Item label="Giảm giá theo">
                {selectedPromotion?.discountType === "percent"
                  ? "Phần trăm (%)"
                  : "Số tiền (VNĐ)"}
              </Descriptions.Item>

              <Descriptions.Item label="Trạng thái">
                {renderStatusTag(selectedPromotion?.computedStatus)}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày bắt đầu">
                {selectedPromotion?.startDate
                  ? dayjs(selectedPromotion.startDate).format(
                      "DD/MM/YYYY HH:mm",
                    )
                  : ""}
              </Descriptions.Item>

              <Descriptions.Item label="Ngày kết thúc">
                {selectedPromotion?.expiredDate
                  ? dayjs(selectedPromotion.expiredDate).format(
                      "DD/MM/YYYY HH:mm",
                    )
                  : ""}
              </Descriptions.Item>

              <Descriptions.Item label="Tổng số lượng">
                {selectedPromotion?.totalAmount || 0}
              </Descriptions.Item>

              <Descriptions.Item label="Doanh thu">
                {Number(selectedPromotion?.totalRevenue || 0).toLocaleString(
                  "vi-VN",
                )}{" "}
                ₫
              </Descriptions.Item>
            </Descriptions>

            {selectedPromotion?.scope === "PRODUCT" &&
            selectedPromotion?.products?.length ? (
              <div className="mt-16">
                <Table
                  rowKey="idProduct"
                  bordered
                  pagination={false}
                  dataSource={selectedPromotion.products}
                  columns={[
                    {
                      title: "Sản phẩm",
                      render: (_: any, record: any) => (
                        <div className="flex items-center">
                          {record?.image ? (
                            <img
                              src={record.image}
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                                borderRadius: 6,
                              }}
                            />
                          ) : null}
                          <div className="ml-8">
                            <div>{record?.productName}</div>
                            <div className="text-gray-500">
                              {record?.idProduct}
                            </div>
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: "Giảm BTC",
                      dataIndex: "priceBtc",
                      render: (value: number | null) =>
                        value === null
                          ? "-"
                          : selectedPromotion?.discountType === "percent"
                            ? `${value}%`
                            : `${Number(value).toLocaleString("vi-VN")} ₫`,
                    },
                    {
                      title: "Giảm BTB",
                      dataIndex: "priceBtb",
                      render: (value: number | null) =>
                        value === null
                          ? "-"
                          : selectedPromotion?.discountType === "percent"
                            ? `${value}%`
                            : `${Number(value).toLocaleString("vi-VN")} ₫`,
                    },
                    {
                      title: "Giảm CTV",
                      dataIndex: "priceCtv",
                      render: (value: number | null) =>
                        value === null
                          ? "-"
                          : selectedPromotion?.discountType === "percent"
                            ? `${value}%`
                            : `${Number(value).toLocaleString("vi-VN")} ₫`,
                    },
                    {
                      title: "Số lượng",
                      dataIndex: "totalAmount",
                    },
                    {
                      title: "Đã dùng",
                      dataIndex: "usedAmount",
                    },
                    {
                      title: "Doanh thu",
                      dataIndex: "totalRevenue",
                      render: (value: number) =>
                        Number(value || 0).toLocaleString("vi-VN") + " ₫",
                    },
                  ]}
                />
              </div>
            ) : null}

            <div className="flex justify-end mt-16">
              <Button onClick={() => setIsVisible(false)}>Đóng</Button>
            </div>
          </>
        ) : null}

        {mode === "edit" && selectedPromotion ? (
          <Form form={formPromo} layout="vertical" onFinish={handleUpdateDate}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="startDate"
                  label="Ngày bắt đầu"
                  dependencies={["expiredDate"]}
                  rules={[
                    { required: true, message: "Vui lòng chọn ngày bắt đầu" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const expiredDate = getFieldValue("expiredDate");
                        if (
                          value &&
                          expiredDate &&
                          dayjs(value).isAfter(dayjs(expiredDate))
                        ) {
                          return Promise.reject(
                            new Error(
                              "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc",
                            ),
                          );
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <MyDatePicker
                    placeholder="Ngày bắt đầu"
                    className="h-40 w-full"
                    format="DD/MM/YYYY HH:mm"
                    showTime={{ format: "HH:mm" }}
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="expiredDate"
                  label="Ngày kết thúc"
                  dependencies={["startDate"]}
                  rules={[
                    { required: true, message: "Vui lòng chọn ngày kết thúc" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const startDate = getFieldValue("startDate");
                        if (
                          value &&
                          startDate &&
                          dayjs(value).isBefore(dayjs(startDate))
                        ) {
                          return Promise.reject(
                            new Error(
                              "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
                            ),
                          );
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <MyDatePicker
                    placeholder="Ngày kết thúc"
                    className="h-40 w-full"
                    format="DD/MM/YYYY HH:mm"
                    showTime={{ format: "HH:mm" }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setIsVisible(false);
                  setSelectedPromotion(null);
                  formPromo.resetFields();
                }}
              >
                Huỷ
              </Button>
              <Button className="ml-16" type="primary" htmlType="submit">
                Lưu thay đổi
              </Button>
            </div>
          </Form>
        ) : null}
      </Modal>
    </div>
  );
};

const ManagePromotion = memo(Component);

export { ManagePromotion };

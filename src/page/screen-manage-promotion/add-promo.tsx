import { useForm } from "antd/es/form/Form";
import { memo, useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  CheckboxOptionType,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Radio,
} from "antd";
import { hideLoading, showLoading } from "../loading";
import { db } from "../../../firebase";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import MyDatePicker from "@/components/basic/date-picker";
import { ProductOutlined } from "@ant-design/icons";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Component = () => {
  const [form] = useForm();
  const [formPromo] = useForm();

  const [products, setProducts] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);

  const [searchData, setSearchData] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectProduct, setSelectProduct] = useState<React.Key[]>([]);
  const [selectedRows, setSelectRows] = useState<any[]>([]);
  const [productPromo, setProductPromo] = useState<any[]>([]);

  const [typePromo, setTypePromo] = useState<
    "CUSTOMER" | "CART" | "PRODUCT" | undefined
  >();
  const [discountBy, setDiscountBy] = useState<
    "percent" | "amount" | undefined
  >();

  const onSearch = useCallback(() => {
    const values = formPromo.getFieldsValue();

    setIsSearching(true);

    let filteredData = [...products];

    if (values.keyword) {
      filteredData = filteredData.filter(
        (item) =>
          item.name?.toLowerCase().includes(values.keyword.toLowerCase()) ||
          item.id?.toLowerCase().includes(values.keyword.toLowerCase()),
      );
    }

    setSearchData(filteredData);
  }, [formPromo, products]);

  const fetchProducts = async () => {
    try {
      showLoading();

      const q = query(
        collection(db, "Products"),
        where("status", "==", "AVAILABLE"),
      );

      const querySnapshot = await getDocs(q);

      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(data);
    } catch (error) {
      console.error(error);
      toast.error("Lấy dữ liệu sản phẩm thất bại");
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const columns = [
    {
      title: "Ảnh",
      render: (_: any, record: any) => (
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
      width: 160,
    },

    {
      title: "Tên sản phẩm",
      dataIndex: "name",
      width: 300,
    },

    {
      title: "Danh mục",
      dataIndex: "category",
    },

    {
      title: "Giá CTV",
      render: (_: any, record: any) => {
        const price = record.variants?.[0]?.prices?.ctv || 0;
        return price.toLocaleString("vi-VN") + " ₫";
      },
    },

    {
      title: "Giá BTC",
      render: (_: any, record: any) => {
        const price = record.variants?.[0]?.prices?.btc || 0;
        return price.toLocaleString("vi-VN") + " ₫";
      },
    },

    {
      title: "Giá BTB",
      render: (_: any, record: any) => {
        const price = record.variants?.[0]?.prices?.btb || 0;
        return price.toLocaleString("vi-VN") + " ₫";
      },
    },

    {
      title: "Tồn kho",
      render: (_: any, record: any) => {
        const total = record.variants?.reduce(
          (sum: number, v: any) => sum + (v.stock || 0),
          0,
        );
        return total;
      },
    },

    {
      title: "Variants",
      render: (_: any, record: any) => record.variants?.length || 1,
    },

    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (value: string) => {
        if (value === "AVAILABLE") return <Tag color="green">Còn hàng</Tag>;
        if (value === "SOLDOUT") return <Tag color="red">Hết hàng</Tag>;
        return <Tag color="orange">Không khả dụng</Tag>;
      },
    },
  ];

  const customerTypes = [
    { id: "CUSTOMER", label: "Khách lẻ" },
    { id: "BTB", label: "Khách buôn/sỉ" },
    { id: "CTV", label: "Cộng tác viên" },
  ];

  const getPromotionStatus = (
    startDate: dayjs.Dayjs,
    expiredDate: dayjs.Dayjs,
  ) => {
    const now = dayjs();

    if (now.isBefore(startDate)) return "UPCOMING";
    if (now.isAfter(expiredDate)) return "EXPIRED";
    return "ONGOING";
  };

  const buildPromotionPayload = (values: any) => {
    const startDate = dayjs(values.fromDate);
    const expiredDate = dayjs(values.expiredDate);

    const payload: any = {
      name: values.name?.trim(),
      startDate: startDate.toISOString(),
      expiredDate: expiredDate.toISOString(),
      status: getPromotionStatus(startDate, expiredDate),
      scope: values.scope,
      discountType: values.discountBy,
      products: [],
      userBought: [],
      totalAmount: null,
      totalSale: 0,
      totalRevenue: 0,
      customerConfigs: [],
      cartConfig: null,
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    };

    if (values.scope === "CUSTOMER") {
      payload.customerConfigs = customerTypes
        .map((item) => {
          const discountValue = values[`customerDiscount_${item.id}`];
          const totalAmount = values[`customerAmount_${item.id}`];

          if (
            (discountValue === undefined ||
              discountValue === null ||
              discountValue === "") &&
            (totalAmount === undefined ||
              totalAmount === null ||
              totalAmount === "")
          ) {
            return null;
          }

          return {
            customerType: item.id,
            discountValue:
              discountValue !== undefined &&
              discountValue !== null &&
              discountValue !== ""
                ? Number(discountValue)
                : null,
            totalAmount:
              totalAmount !== undefined &&
              totalAmount !== null &&
              totalAmount !== ""
                ? Number(totalAmount)
                : 0,
            usedAmount: 0,
          };
        })
        .filter(Boolean);

      payload.totalAmount = payload.customerConfigs.reduce(
        (sum: number, item: any) => sum + (item.totalAmount || 0),
        0,
      );
    }

    if (values.scope === "CART") {
      payload.cartConfig = {
        priceFrom: Number(values.priceFrom),
        priceTo: Number(values.priceTo),
        discountValue: Number(values.cartDiscountValue),
        totalAmount: Number(values.cartTotalAmount),
        usedAmount: 0,
      };

      payload.totalAmount = Number(values.cartTotalAmount);
    }

    if (values.scope === "PRODUCT") {
      const productsPayload = productPromo.map((product: any) => {
        const priceBtc = values[`priceBtc_${product.id}`];
        const priceBtb = values[`priceBtb_${product.id}`];
        const priceCtv = values[`priceCtv_${product.id}`];
        const totalAmount = values[`totalAmount_${product.id}`];

        return {
          idProduct: product.id,
          productName: product.name,
          category: product.category || null,
          image: product.images?.[0] || null,
          priceBtc:
            priceBtc !== undefined && priceBtc !== null && priceBtc !== ""
              ? Number(priceBtc)
              : null,
          priceBtb:
            priceBtb !== undefined && priceBtb !== null && priceBtb !== ""
              ? Number(priceBtb)
              : null,
          priceCtv:
            priceCtv !== undefined && priceCtv !== null && priceCtv !== ""
              ? Number(priceCtv)
              : null,
          totalAmount:
            totalAmount !== undefined &&
            totalAmount !== null &&
            totalAmount !== ""
              ? Number(totalAmount)
              : 0,
          usedAmount: 0,
          totalSale: 0,
          totalRevenue: 0,
        };
      });

      payload.products = productsPayload;
      payload.totalAmount = productsPayload.reduce(
        (sum: number, item: any) => sum + (item.totalAmount || 0),
        0,
      );
    }

    return payload;
  };

  const navigate = useNavigate();
  const onSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.scope === "PRODUCT" && productPromo.length === 0) {
        toast.error("Vui lòng chọn ít nhất 1 sản phẩm");
        return;
      }

      if (values.scope === "CUSTOMER") {
        const hasCustomerConfig = customerTypes.some((item) => {
          const discountValue = values[`customerDiscount_${item.id}`];
          const totalAmount = values[`customerAmount_${item.id}`];
          return (
            discountValue !== undefined &&
            discountValue !== null &&
            discountValue !== "" &&
            totalAmount !== undefined &&
            totalAmount !== null &&
            totalAmount !== ""
          );
        });

        if (!hasCustomerConfig) {
          toast.error("Vui lòng cấu hình ít nhất 1 nhóm khách hàng");
          return;
        }
      }

      const payload = buildPromotionPayload(values);

      showLoading();
      await addDoc(collection(db, "Promotions"), payload);

      toast.success("Tạo chương trình khuyến mãi thành công");
      navigate("/promotion");
      form.resetFields();
      formPromo.resetFields();
      setTypePromo(undefined);
      setDiscountBy(undefined);
      setProductPromo([]);
      setSelectProduct([]);
      setSelectRows([]);
      setSearchData([]);
      setIsSearching(false);
      setVisible(false);
    } catch (error) {
      console.error(error);
      toast.error("Tạo chương trình khuyến mãi thất bại");
    } finally {
      hideLoading();
    }
  };

  const getOriginalPrice = (product: any, priceKey: "btc" | "btb" | "ctv") => {
    return Number(product?.variants?.[0]?.prices?.[priceKey] || 0);
  };

  const formatMoney = (value: number) => {
    return Number(value || 0).toLocaleString("vi-VN");
  };

  const validateProductDiscount = ({
    value,
    product,
    priceKey,
    otherValues,
  }: {
    value: any;
    product: any;
    priceKey: "btc" | "btb" | "ctv";
    otherValues: any[];
  }) => {
    const hasCurrentValue =
      value !== undefined && value !== null && value !== "";
    const hasOtherValue = otherValues.some(
      (item) => item !== undefined && item !== null && item !== "",
    );

    if (!hasCurrentValue && !hasOtherValue) {
      return "Phải nhập ít nhất 1 giá trị giảm cho sản phẩm";
    }

    if (!hasCurrentValue) {
      return null;
    }

    const numValue = Number(value);

    if (Number.isNaN(numValue)) {
      return "Giá trị không hợp lệ";
    }

    if (numValue <= 0) {
      return "Giá trị phải lớn hơn 0";
    }

    if (discountBy === "percent" && numValue > 100) {
      return "Giảm giá theo % không được vượt quá 100";
    }

    if (discountBy === "amount") {
      const originalPrice = getOriginalPrice(product, priceKey);
      if (numValue > originalPrice) {
        return `Giá giảm không được lớn hơn giá gốc (${formatMoney(originalPrice)} VNĐ)`;
      }
    }

    return null;
  };

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  return (
    <div className="block-content">
      <Card title="Danh sách khuyến mãi">
        <Form
          form={form}
          name="validateOnly"
          layout="vertical"
          autoComplete="off"
          onFinish={onSubmit}
        >
          <Col span={12}>
            <Form.Item
              label="Tên chương trình khuyến mãi"
              name="name"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập tên chương trình khuyến mãi",
                },
              ]}
            >
              <Input className="h-40" placeholder="Nhập tên" />
            </Form.Item>
          </Col>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item
                name="fromDate"
                label="Từ ngày"
                dependencies={["expiredDate"]}
                rules={[
                  { required: true, message: "Vui lòng chọn ngày bắt đầu" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const expiredDate = getFieldValue("expiredDate");
                      const now = dayjs();

                      if (value && dayjs(value).valueOf() < now.valueOf()) {
                        return Promise.reject(
                          new Error(
                            "Vui lòng không chọn ngày giờ trước thời điểm hiện tại",
                          ),
                        );
                      }

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
                  placeholder="Từ ngày"
                  className="h-40 w-full"
                  format="DD/MM/YYYY HH:mm"
                  showTime={{ format: "HH:mm" }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="expiredDate"
                label="Đến ngày"
                dependencies={["fromDate"]}
                rules={[
                  { required: true, message: "Vui lòng chọn ngày kết thúc" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const fromDate = getFieldValue("fromDate");

                      if (
                        value &&
                        fromDate &&
                        dayjs(value).isBefore(dayjs(fromDate))
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
                  placeholder="Đến ngày"
                  className="h-40 w-full"
                  format="DD/MM/YYYY HH:mm"
                  showTime={{ format: "HH:mm" }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="scope"
                label="Loại khuyến mãi"
                rules={[
                  { required: true, message: "Vui lòng chọn loại khuyến mãi" },
                ]}
              >
                <Select
                  size="large"
                  showSearch
                  allowClear
                  onChange={(value) => {
                    setTypePromo(value);
                    setProductPromo([]);
                    setSelectProduct([]);
                    setSelectRows([]);

                    form.setFieldsValue({
                      priceFrom: undefined,
                      priceTo: undefined,
                      cartDiscountValue: undefined,
                      cartTotalAmount: undefined,
                    });

                    customerTypes.forEach((item) => {
                      form.setFieldValue(
                        `customerDiscount_${item.id}`,
                        undefined,
                      );
                      form.setFieldValue(
                        `customerAmount_${item.id}`,
                        undefined,
                      );
                    });
                  }}
                  optionFilterProp="label"
                  options={[
                    { label: "Theo khách hàng", value: "CUSTOMER" },
                    { label: "Theo Giá trị đơn hàng", value: "CART" },
                    { label: "Theo Sản phẩm", value: "PRODUCT" },
                  ]}
                  placeholder="Chọn loại khuyến mãi"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Giảm giá theo"
                name="discountBy"
                rules={[
                  { required: true, message: "Vui lòng chọn loại giảm giá" },
                ]}
              >
                <Radio.Group
                  onChange={(e) => {
                    setDiscountBy(e.target.value);

                    customerTypes.forEach((item) => {
                      form.setFieldValue(
                        `customerDiscount_${item.id}`,
                        undefined,
                      );
                    });

                    form.setFieldsValue({
                      cartDiscountValue: undefined,
                    });

                    productPromo.forEach((item: any) => {
                      form.setFieldValue(`priceBtc_${item.id}`, undefined);
                      form.setFieldValue(`priceBtb_${item.id}`, undefined);
                      form.setFieldValue(`priceCtv_${item.id}`, undefined);
                    });
                  }}
                  options={[
                    { label: "Giảm giá theo Phần trăm (%)", value: "percent" },
                    { label: "Giảm giá theo Số tiền (VNĐ)", value: "amount" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {typePromo === "CUSTOMER" && discountBy
            ? customerTypes.map((item) => (
                <Row gutter={24} key={item.id}>
                  <Col span={12}>
                    <Form.Item
                      label={item.label}
                      name={`customerDiscount_${item.id}`}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            const totalAmount = getFieldValue(
                              `customerAmount_${item.id}`,
                            );
                            if (
                              (value === undefined ||
                                value === null ||
                                value === "") &&
                              totalAmount
                            ) {
                              return Promise.reject(
                                new Error("Vui lòng nhập giá trị giảm"),
                              );
                            }
                            if (
                              value !== undefined &&
                              value !== null &&
                              value !== "" &&
                              Number(value) <= 0
                            ) {
                              return Promise.reject(
                                new Error("Giá trị giảm phải lớn hơn 0"),
                              );
                            }
                            if (
                              discountBy === "percent" &&
                              Number(value) > 100
                            ) {
                              return Promise.reject(
                                new Error(
                                  "Giảm giá theo % không được vượt quá 100",
                                ),
                              );
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      {discountBy === "percent" ? (
                        <InputNumber
                          className="h-40 w-full"
                          min={0}
                          max={100}
                          suffix="%"
                        />
                      ) : (
                        <InputNumber
                          className="h-40 w-full"
                          min={0}
                          suffix="VNĐ"
                          formatter={(value) =>
                            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                          }
                          parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                        />
                      )}
                    </Form.Item>
                  </Col>

                  <Col span={12}>
                    <Form.Item
                      label="Số lượng phát hành khuyến mãi"
                      name={`customerAmount_${item.id}`}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            const discountValue = getFieldValue(
                              `customerDiscount_${item.id}`,
                            );
                            if (
                              discountValue &&
                              (value === undefined ||
                                value === null ||
                                value === "")
                            ) {
                              return Promise.reject(
                                new Error("Vui lòng nhập số lượng phát hành"),
                              );
                            }
                            if (
                              value !== undefined &&
                              value !== null &&
                              value !== "" &&
                              Number(value) <= 0
                            ) {
                              return Promise.reject(
                                new Error("Số lượng phát hành phải lớn hơn 0"),
                              );
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <InputNumber className="h-40 w-full" min={1} />
                    </Form.Item>
                  </Col>
                </Row>
              ))
            : null}

          {typePromo === "CART" && discountBy ? (
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item
                  label="Giá trị từ"
                  name="priceFrom"
                  rules={[
                    { required: true, message: "Vui lòng nhập giá trị từ" },
                  ]}
                >
                  <InputNumber
                    className="h-40 w-full"
                    min={0}
                    formatter={(value) =>
                      `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                  />
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item
                  label="Đến"
                  name="priceTo"
                  dependencies={["priceFrom"]}
                  rules={[
                    { required: true, message: "Vui lòng nhập giá trị đến" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const priceFrom = getFieldValue("priceFrom");
                        if (
                          value !== undefined &&
                          priceFrom !== undefined &&
                          Number(value) < Number(priceFrom)
                        ) {
                          return Promise.reject(
                            new Error(
                              "Giá trị đến phải lớn hơn hoặc bằng giá trị từ",
                            ),
                          );
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber
                    className="h-40 w-full"
                    min={0}
                    formatter={(value) =>
                      `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                  />
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item
                  label="Giá trị giảm"
                  name="cartDiscountValue"
                  rules={[
                    { required: true, message: "Vui lòng nhập giá trị giảm" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const priceFrom = getFieldValue("priceFrom");

                        if (value !== undefined && Number(value) <= 0) {
                          return Promise.reject(
                            new Error("Giá trị giảm phải lớn hơn 0"),
                          );
                        }

                        if (discountBy === "percent" && Number(value) > 100) {
                          return Promise.reject(
                            new Error(
                              "Giảm giá theo % không được vượt quá 100",
                            ),
                          );
                        }

                        if (
                          discountBy === "amount" &&
                          value !== undefined &&
                          priceFrom !== undefined &&
                          Number(value) > Number(priceFrom)
                        ) {
                          return Promise.reject(
                            new Error(
                              "Giá trị giảm không được lớn hơn giá trị từ",
                            ),
                          );
                        }

                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  {discountBy === "percent" ? (
                    <InputNumber
                      className="h-40 w-full"
                      min={0}
                      max={100}
                      suffix="%"
                    />
                  ) : (
                    <InputNumber
                      className="h-40 w-full"
                      min={0}
                      suffix="VNĐ"
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                    />
                  )}
                </Form.Item>
              </Col>

              <Col span={6}>
                <Form.Item
                  label="Số lượng phát hành khuyến mãi"
                  name="cartTotalAmount"
                  rules={[
                    {
                      required: true,
                      message: "Vui lòng nhập số lượng phát hành",
                    },
                  ]}
                >
                  <InputNumber className="h-40 w-full" min={1} />
                </Form.Item>
              </Col>
            </Row>
          ) : null}

          {typePromo === "PRODUCT" && discountBy ? (
            <>
              <Button
                type="primary"
                icon={<ProductOutlined />}
                onClick={() => setVisible(true)}
                className="mb-24"
              >
                Chọn sản phẩm
              </Button>

              {!productPromo.length ? (
                <div className="mb-16 text-red-500">
                  Vui lòng chọn ít nhất 1 sản phẩm
                </div>
              ) : null}

              {productPromo.map((item: any) => {
                const originalBtc = getOriginalPrice(item, "btc");
                const originalBtb = getOriginalPrice(item, "btb");
                const originalCtv = getOriginalPrice(item, "ctv");

                return (
                  <div key={item.id}>
                    <Row gutter={24}>
                      <Col span={8}>
                        <div className="flex items-center">
                          <img
                            src={item.images?.[0]}
                            style={{
                              width: 60,
                              height: 60,
                              objectFit: "cover",
                              borderRadius: 8,
                            }}
                          />
                          <div className="ml-8">
                            <div className="font-medium">{item?.name}</div>
                            <div className="text-gray-500">{item?.id}</div>
                          </div>
                        </div>
                      </Col>

                      <Col span={4}>
                        <Form.Item
                          name={`priceBtc_${item.id}`}
                          label={`Giảm giá bán lẻ (gốc: ${formatMoney(originalBtc)} VNĐ)`}
                          dependencies={[
                            `priceBtb_${item.id}`,
                            `priceCtv_${item.id}`,
                          ]}
                          rules={[
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                const btbValue = getFieldValue(
                                  `priceBtb_${item.id}`,
                                );
                                const ctvValue = getFieldValue(
                                  `priceCtv_${item.id}`,
                                );

                                const error = validateProductDiscount({
                                  value,
                                  product: item,
                                  priceKey: "btc",
                                  otherValues: [btbValue, ctvValue],
                                });

                                if (error) {
                                  return Promise.reject(new Error(error));
                                }

                                return Promise.resolve();
                              },
                            }),
                          ]}
                        >
                          {discountBy === "percent" ? (
                            <InputNumber
                              className="h-40 w-full"
                              min={0}
                              max={100}
                              suffix="%"
                            />
                          ) : (
                            <InputNumber
                              className="h-40 w-full"
                              min={0}
                              suffix="VNĐ"
                              formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                              }
                              parser={(value) =>
                                value!.replace(/\$\s?|(,*)/g, "")
                              }
                            />
                          )}
                        </Form.Item>
                      </Col>

                      <Col span={4}>
                        <Form.Item
                          name={`priceBtb_${item.id}`}
                          label={`Giảm giá bán buôn (gốc: ${formatMoney(originalBtb)} VNĐ)`}
                          dependencies={[
                            `priceBtc_${item.id}`,
                            `priceCtv_${item.id}`,
                          ]}
                          rules={[
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                const btcValue = getFieldValue(
                                  `priceBtc_${item.id}`,
                                );
                                const ctvValue = getFieldValue(
                                  `priceCtv_${item.id}`,
                                );

                                const error = validateProductDiscount({
                                  value,
                                  product: item,
                                  priceKey: "btb",
                                  otherValues: [btcValue, ctvValue],
                                });

                                if (error) {
                                  return Promise.reject(new Error(error));
                                }

                                return Promise.resolve();
                              },
                            }),
                          ]}
                        >
                          {discountBy === "percent" ? (
                            <InputNumber
                              className="h-40 w-full"
                              min={0}
                              max={100}
                              suffix="%"
                            />
                          ) : (
                            <InputNumber
                              className="h-40 w-full"
                              min={0}
                              suffix="VNĐ"
                              formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                              }
                              parser={(value) =>
                                value!.replace(/\$\s?|(,*)/g, "")
                              }
                            />
                          )}
                        </Form.Item>
                      </Col>

                      <Col span={4}>
                        <Form.Item
                          name={`priceCtv_${item.id}`}
                          label={`Giảm giá CTV (gốc: ${formatMoney(originalCtv)} VNĐ)`}
                          dependencies={[
                            `priceBtc_${item.id}`,
                            `priceBtb_${item.id}`,
                          ]}
                          rules={[
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                const btcValue = getFieldValue(
                                  `priceBtc_${item.id}`,
                                );
                                const btbValue = getFieldValue(
                                  `priceBtb_${item.id}`,
                                );

                                const error = validateProductDiscount({
                                  value,
                                  product: item,
                                  priceKey: "ctv",
                                  otherValues: [btcValue, btbValue],
                                });

                                if (error) {
                                  return Promise.reject(new Error(error));
                                }

                                return Promise.resolve();
                              },
                            }),
                          ]}
                        >
                          {discountBy === "percent" ? (
                            <InputNumber
                              className="h-40 w-full"
                              min={0}
                              max={100}
                              suffix="%"
                            />
                          ) : (
                            <InputNumber
                              className="h-40 w-full"
                              min={0}
                              suffix="VNĐ"
                              formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                              }
                              parser={(value) =>
                                value!.replace(/\$\s?|(,*)/g, "")
                              }
                            />
                          )}
                        </Form.Item>
                      </Col>

                      <Col span={4}>
                        <Form.Item
                          name={`totalAmount_${item.id}`}
                          label="Số lượng phát hành"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng nhập số lượng phát hành",
                            },
                            {
                              validator(_, value) {
                                if (
                                  value === undefined ||
                                  value === null ||
                                  value === ""
                                ) {
                                  return Promise.resolve();
                                }

                                if (Number(value) <= 0) {
                                  return Promise.reject(
                                    new Error(
                                      "Số lượng phát hành phải lớn hơn 0",
                                    ),
                                  );
                                }

                                return Promise.resolve();
                              },
                            },
                          ]}
                        >
                          <InputNumber className="h-40 w-full" min={1} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider />
                  </div>
                );
              })}
            </>
          ) : null}

          <div className="flex justify-end mt-24">
            <Button type="primary" htmlType="submit">
              Lưu chương trình khuyến mãi
            </Button>
          </div>
        </Form>
      </Card>
      <Modal
        title="Tạo mới khuyến mãi"
        open={visible}
        width={1000}
        footer={null}
        onCancel={() => setVisible(false)}
      >
        <Form
          form={formPromo}
          name="validateOnly"
          layout="vertical"
          autoComplete="off"
        >
          <div className="flex flex-row items-center">
            <Form.Item name={"keyword"} className="flex-1">
              <Input
                className="h-40"
                placeholder="Tìm kiếm theo ID, tên sản phẩm"
              />
            </Form.Item>

            <Form.Item className="ml-16">
              <Button
                onClick={() => onSearch()}
                type="primary"
                className="h-40"
              >
                Tìm kiếm
              </Button>
            </Form.Item>
          </div>
        </Form>

        <Table
          rowKey={"id"}
          bordered
          dataSource={isSearching ? searchData : products}
          columns={columns}
          scroll={{ y: 500, x: 150 * columns?.length }}
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
          rowSelection={{
            type: "checkbox",
            selectedRowKeys: selectProduct,
            onChange: (selectedRowKeys, selectedRows) => {
              setSelectProduct(selectedRowKeys);
              setSelectRows(selectedRows);
            },
          }}
        />
        <div className="flex flex-row items-center justify-end">
          <Button
            onClick={() => {
              setVisible(false);
              setSelectProduct([]);
              setSelectRows([]);
            }}
          >
            Huỷ
          </Button>
          <Button
            disabled={!selectProduct?.length}
            className="ml-16"
            type="primary"
            onClick={() => {
              setVisible(false);
              setProductPromo(selectedRows);
              setSearchData([]);
              setIsSearching(false);
            }}
          >
            Chọn
          </Button>
        </div>
      </Modal>
    </div>
  );
};

const AddPromotion = memo(Component);

export { AddPromotion };

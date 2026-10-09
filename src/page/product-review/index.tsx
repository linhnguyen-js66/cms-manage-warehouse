import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Image,
  Input,
  List,
  Modal,
  Rate,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { auth } from "../../../firebase";
import { toast } from "react-toastify";
import {
  ProductReviewDoc,
  replyProductReview,
  subscribeAllProductReviews,
  toggleProductReviewVisible,
} from "./product-review.service";

type ProductReviewGroup = {
  productId: string;
  productName: string;
  productImage?: string;
  totalReviews: number;
  averageRating: number;
  lastReviewedAt?: string;
  totalVisible: number;
  totalReplied: number;
  reviews: ProductReviewDoc[];
};

export default function AdminProductReviewsPage() {
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ProductReviewDoc[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ProductReviewGroup | null>(
    null,
  );
  const [replyingReview, setReplyingReview] = useState<ProductReviewDoc | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAllProductReviews((data) => {
      setReviews(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const groupedProducts = useMemo<ProductReviewGroup[]>(() => {
    const map = new Map<string, ProductReviewGroup>();

    reviews.forEach((item) => {
      const existing = map.get(item.productId);

      if (existing) {
        existing.reviews.push(item);
        existing.totalReviews += 1;
        existing.totalVisible += item.status === "VISIBLE" ? 1 : 0;
        existing.totalReplied += item.staffReply?.content ? 1 : 0;
        if (
          dayjs(item.createdAt).valueOf() >
          dayjs(existing.lastReviewedAt || 0).valueOf()
        ) {
          existing.lastReviewedAt = item.createdAt;
        }
        return;
      }

      map.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        totalReviews: 1,
        averageRating: 0,
        lastReviewedAt: item.createdAt,
        totalVisible: item.status === "VISIBLE" ? 1 : 0,
        totalReplied: item.staffReply?.content ? 1 : 0,
        reviews: [item],
      });
    });

    return Array.from(map.values())
      .map((group) => {
        const totalRating = group.reviews.reduce(
          (sum, item) => sum + Number(item.rating || 0),
          0,
        );

        return {
          ...group,
          averageRating: group.totalReviews
            ? totalRating / group.totalReviews
            : 0,
          reviews: [...group.reviews].sort(
            (a, b) =>
              dayjs(b.createdAt || 0).valueOf() -
              dayjs(a.createdAt || 0).valueOf(),
          ),
        };
      })
      .sort(
        (a, b) =>
          dayjs(b.lastReviewedAt || 0).valueOf() -
          dayjs(a.lastReviewedAt || 0).valueOf(),
      );
  }, [reviews]);

  const handleOpenDetail = (group: ProductReviewGroup) => {
    setSelectedGroup(group);
    setDetailOpen(true);
  };

  const handleOpenReply = (review: ProductReviewDoc) => {
    setReplyingReview(review);
    form.setFieldsValue({
      replyContent: review.staffReply?.content || "",
    });
    setReplyOpen(true);
  };

  const handleSubmitReply = async () => {
    try {
      const values = await form.validateFields();

      if (!replyingReview) return;

      setSubmitting(true);

      await replyProductReview({
        reviewId: replyingReview.id,
        content: values.replyContent,
        staffId: auth.currentUser?.uid || "staff_001",
        staffName:
          auth.currentUser?.displayName ||
          auth.currentUser?.email ||
          "Nhân viên",
      });

      toast.success("Trả lời đánh giá thành công");
      setReplyOpen(false);
      setReplyingReview(null);
      form.resetFields();
    } catch (error) {
      if ((error as any)?.errorFields) return;
      console.error(error);
      toast.error("Không thể gửi trả lời");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisible = async (review: ProductReviewDoc) => {
    try {
      await toggleProductReviewVisible(
        review.id,
        review.status === "VISIBLE" ? "HIDDEN" : "VISIBLE",
      );
      toast.success(
        review.status === "VISIBLE"
          ? "Đã ẩn đánh giá"
          : "Đã hiển thị lại đánh giá",
      );
    } catch (error) {
      console.error(error);
      toast.error("Cập nhật trạng thái đánh giá thất bại");
    }
  };

  const columns: ColumnsType<ProductReviewGroup> = [
    {
      title: "Sản phẩm",
      dataIndex: "productName",
      render: (_, record) => (
        <div className="flex items-center gap-12">
          <div className="h-60 w-60 overflow-hidden rounded-radius-m border border-color-300 bg-color-100">
            {record.productImage ? (
              <Image
                src={record.productImage}
                alt={record.productName}
                preview={false}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div>
            <div className="text-15 font-medium text-color-900">
              {record.productName}
            </div>
            <div className="text-13 text-color-700">{record.productId}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Đánh giá",
      dataIndex: "totalReviews",
      width: 120,
      render: (value) => <span>{value}</span>,
    },
    {
      title: "Điểm TB",
      dataIndex: "averageRating",
      width: 180,
      render: (value: number) => (
        <div>
          <Rate disabled allowHalf value={value} />
          <div className="text-13 text-color-700">{value.toFixed(1)}/5</div>
        </div>
      ),
    },
    {
      title: "Đã phản hồi",
      dataIndex: "totalReplied",
      width: 140,
    },
    {
      title: "Cập nhật cuối",
      dataIndex: "lastReviewedAt",
      width: 180,
      render: (value?: string) =>
        value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "-",
    },
    {
      title: "Thao tác",
      width: 150,
      render: (_, record) => (
        <Button type="primary" onClick={() => handleOpenDetail(record)}>
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div className="block-content">
      <Row gutter={[16, 16]} className="mb-24">
        <Col span={8} mobile={24}>
          <Card bordered={false}>
            <Statistic
              title="Tổng sản phẩm có đánh giá"
              value={groupedProducts.length}
            />
          </Card>
        </Col>
        <Col span={8} mobile={24}>
          <Card bordered={false}>
            <Statistic title="Tổng lượt đánh giá" value={reviews.length} />
          </Card>
        </Col>
        <Col span={8} mobile={24}>
          <Card bordered={false}>
            <Statistic
              title="Đánh giá đã phản hồi"
              value={reviews.filter((item) => item.staffReply?.content).length}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Sản phẩm được đánh giá"
        bordered={false}
        className="rounded-radius-xl shadow-down-s"
      >
        <Table
          rowKey="productId"
          loading={loading}
          columns={columns}
          dataSource={groupedProducts}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="Chưa có đánh giá nào" /> }}
        />
      </Card>

      <Modal
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedGroup(null);
        }}
        footer={null}
        width={1100}
        title={selectedGroup?.productName || "Chi tiết đánh giá"}
      >
        {selectedGroup ? (
          <List
            dataSource={selectedGroup.reviews}
            itemLayout="vertical"
            renderItem={(item) => (
              <List.Item key={item.id}>
                <div className="rounded-radius-l border border-color-300 p-16">
                  <div className="mb-12 flex items-start justify-between gap-16">
                    <div className="flex items-start gap-12">
                      <Avatar>
                        {(item.userName || "U").charAt(0).toUpperCase()}
                      </Avatar>
                      <div>
                        <div className="text-15 font-medium text-color-900">
                          {item.userName}
                        </div>
                        <div className="mb-4">
                          <Rate disabled value={item.rating} />
                        </div>
                        <div className="text-13 text-color-700">
                          {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
                        </div>
                      </div>
                    </div>

                    <Space>
                      <Tag
                        color={item.status === "VISIBLE" ? "green" : "default"}
                      >
                        {item.status === "VISIBLE" ? "Đang hiển thị" : "Đã ẩn"}
                      </Tag>
                      <Button onClick={() => handleToggleVisible(item)}>
                        {item.status === "VISIBLE"
                          ? "Ẩn đánh giá"
                          : "Hiện đánh giá"}
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => handleOpenReply(item)}
                      >
                        {item.staffReply?.content ? "Sửa phản hồi" : "Trả lời"}
                      </Button>
                    </Space>
                  </div>

                  <div className="mb-12 whitespace-pre-wrap text-15 leading-24 text-color-800">
                    {item.content}
                  </div>

                  {item.imageUrls?.length ? (
                    <div className="mb-12 grid grid-cols-4 gap-12 mobile:grid-cols-2">
                      {item.imageUrls.map((url, index) => (
                        <div
                          key={`${item.id}_${index}`}
                          className="overflow-hidden rounded-radius-m border border-color-300"
                        >
                          <Image
                            src={url}
                            alt={`review_${index}`}
                            className="h-[120px] w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {item.staffReply?.content ? (
                    <div className="rounded-radius-l bg-color-100 p-16">
                      <div className="mb-8 text-14 font-medium text-color-900">
                        Phản hồi từ nhân viên
                      </div>
                      <div className="mb-8 whitespace-pre-wrap text-14 leading-24 text-color-800">
                        {item.staffReply.content}
                      </div>
                      <div className="text-12 text-color-700">
                        {item.staffReply.staffName} -{" "}
                        {dayjs(item.staffReply.updatedAt).format(
                          "DD/MM/YYYY HH:mm",
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </List.Item>
            )}
          />
        ) : null}
      </Modal>

      <Modal
        open={replyOpen}
        onCancel={() => {
          setReplyOpen(false);
          setReplyingReview(null);
          form.resetFields();
        }}
        onOk={handleSubmitReply}
        confirmLoading={submitting}
        title="Trả lời đánh giá"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Nội dung phản hồi"
            name="replyContent"
            rules={[
              { required: true, message: "Vui lòng nhập nội dung phản hồi" },
            ]}
          >
            <Input.TextArea rows={5} placeholder="Nhập phản hồi từ nhân viên" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

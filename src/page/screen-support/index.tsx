import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Switch,
  Typography,
  Upload,
  message as antdMessage,
} from "antd";
import {
  PictureOutlined,
  ProductOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  buildProductSnapshot,
  disableBotForConversation,
  loadProducts,
  markConversationReadForStaff,
  sendImageMessage,
  sendProductMessage,
  sendTextMessage,
  subscribeConversations,
  subscribeMessages,
  type ConversationItem,
  type MessageItem,
  type ProductItem,
} from "@/services/chat.service";

const { Text, Title } = Typography;

const STAFF_ID = "staff_001";
const STAFF_NAME = "Lien";

const getConversationIdentityLabel = (conversation?: ConversationItem | null) => {
  if (!conversation) return "--";

  return (
    conversation.customerUserId ||
    conversation.customerId ||
    conversation.customerKey ||
    conversation.guestSessionId ||
    "--"
  );
};

const getConversationDisplayName = (conversation?: ConversationItem | null) => {
  if (!conversation) return "Khách hàng";

  return (
    conversation.customerName ||
    conversation.customerEmail ||
    conversation.customerPhone ||
    getConversationIdentityLabel(conversation)
  );
};

const Component = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);

  const [text, setText] = useState("");

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productKeyword, setProductKeyword] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const localSendingRef = useRef(false);

  const filteredProducts = useMemo(() => {
    const kw = productKeyword.trim().toLowerCase();
    if (!kw) return products;

    return products.filter(
      (item) =>
        item.name?.toLowerCase().includes(kw) ||
        item.id?.toLowerCase().includes(kw),
    );
  }, [productKeyword, products]);

  useEffect(() => {
    const unsubscribe = subscribeConversations((items) => {
      setConversations(items);

      if (!selectedConversation && items.length) {
        setSelectedConversation(items[0]);
        return;
      }

      if (selectedConversation) {
        const current = items.find((it) => it.id === selectedConversation.id);
        if (current) {
          setSelectedConversation(current);
        } else if (items.length) {
          setSelectedConversation(items[0]);
        } else {
          setSelectedConversation(null);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages([]);
      return;
    }

    setLoadingConversation(true);

    const unsubscribe = subscribeMessages(
      selectedConversation.id,
      async (items) => {
        setMessages(items);
        setLoadingConversation(false);

        try {
          await markConversationReadForStaff(selectedConversation.id);
        } catch {
          // ignore
        }

        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      },
    );

    return () => unsubscribe();
  }, [selectedConversation?.id]);

  const handleSendText = async () => {
    const trimmed = text.trim();

    if (!selectedConversation?.id || !trimmed) return;
    if (sending || localSendingRef.current) return;

    localSendingRef.current = true;

    try {
      setSending(true);
      await sendTextMessage({
        conversationId: selectedConversation.id,
        senderId: STAFF_ID,
        senderRole: "staff",
        text: trimmed,
      });
      setText("");
    } catch (error) {
      console.error(error);
      antdMessage.error("Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
      localSendingRef.current = false;
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!selectedConversation?.id) return false;
    if (sending || localSendingRef.current) return false;

    localSendingRef.current = true;

    try {
      setSending(true);
      await sendImageMessage({
        conversationId: selectedConversation.id,
        senderId: STAFF_ID,
        senderRole: "staff",
        file,
      });
    } catch (error) {
      console.error(error);
      antdMessage.error("Gửi ảnh thất bại");
    } finally {
      setSending(false);
      localSendingRef.current = false;
    }

    return false;
  };

  const openProductModal = async () => {
    setProductModalOpen(true);

    if (!products.length) {
      try {
        setLoadingProducts(true);
        const data = await loadProducts();
        setProducts(data);
      } catch (error) {
        console.error(error);
        antdMessage.error("Không tải được danh sách sản phẩm");
      } finally {
        setLoadingProducts(false);
      }
    }
  };

  const handleSendProduct = async (product: ProductItem) => {
    if (!selectedConversation?.id) return;
    if (sending || localSendingRef.current) return;

    localSendingRef.current = true;

    try {
      setSending(true);
      await sendProductMessage({
        conversationId: selectedConversation.id,
        senderId: STAFF_ID,
        senderRole: "staff",
        product: buildProductSnapshot(product),
      });
      setProductModalOpen(false);
    } catch (error) {
      console.error(error);
      antdMessage.error("Gửi sản phẩm thất bại");
    } finally {
      setSending(false);
      localSendingRef.current = false;
    }
  };

  const renderMessage = (item: MessageItem) => {
    const isMine = item.senderRole === "staff";
    const isBot = item.senderRole === "bot";

    return (
      <div
        key={item.id}
        className={`mb-12 flex ${isMine ? "justify-end" : "justify-start"}`}
      >
        <div
          className={`max-w-[72%] rounded-radius-l px-12 py-8 shadow-down-s ${
            isMine
              ? "bg-primary-500 text-common-0"
              : isBot
                ? "bg-pending-100"
                : "bg-color-100"
          }`}
        >
          <div className="mb-4">
            <Text className="text-12 opacity-xl">
              {item.senderRole === "staff"
                ? STAFF_NAME
                : item.senderRole === "bot"
                  ? "Bot hỗ trợ"
                  : getConversationDisplayName(selectedConversation)}
            </Text>
          </div>

          {item.type === "text" ? (
            <div className="whitespace-pre-wrap break-words">{item.text}</div>
          ) : null}

          {item.type === "image" && item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt="chat"
              className="max-w-full rounded-radius-m"
            />
          ) : null}

          {item.type === "product" && item.product ? (
            <Card
              size="small"
              className="min-w-[260px]"
              cover={
                item.product.image ? (
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="h-[160px] object-cover"
                  />
                ) : undefined
              }
            >
              <div className="mb-8 text-14 font-medium">{item.product.name}</div>
              <div className="mb-4 text-12 text-color-700">
                {item.product.id}
              </div>
              <div className="text-13">
                Bán lẻ:{" "}
                {Number(item.product.priceBtc || 0).toLocaleString("vi-VN")} ₫
              </div>
              <div className="text-13">
                Bán buôn:{" "}
                {Number(item.product.priceBtb || 0).toLocaleString("vi-VN")} ₫
              </div>
              <div className="text-13">
                CTV:{" "}
                {Number(item.product.priceCtv || 0).toLocaleString("vi-VN")} ₫
              </div>
            </Card>
          ) : null}

          <div className="mt-8 text-11 opacity-xl">
            {item.createdAt?.toDate
              ? dayjs(item.createdAt.toDate()).format("DD/MM/YYYY HH:mm")
              : ""}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-16">
      <Card
        className="h-full w-[320px] overflow-hidden"
        bodyStyle={{ padding: 0, height: "100%" }}
      >
        <div className="border-b border-color-300 p-16">
          <Title level={5} className="!mb-0">
            Khách hàng
          </Title>
        </div>

        <div className="h-[calc(100%-57px)] overflow-y-auto">
          {conversations.length ? (
            <List
              dataSource={conversations}
              renderItem={(item) => {
                const active = selectedConversation?.id === item.id;

                return (
                  <List.Item
                    className={`!cursor-pointer !px-16 !py-12 border-b border-color-200 ${
                      active ? "bg-primary-50" : ""
                    }`}
                    onClick={() => setSelectedConversation(item)}
                  >
                    <div className="flex w-full items-center">
                      <Badge count={item.unreadStaff || 0} size="small">
                        <Avatar
                          size={44}
                          src={item.customerAvatar || undefined}
                          icon={<UserOutlined />}
                        />
                      </Badge>

                      <div className="ml-12 min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {getConversationDisplayName(item)}
                        </div>
                        <div className="truncate text-12 text-color-700">
                          {item.lastMessageType === "image"
                            ? "[Hình ảnh]"
                            : item.lastMessageType === "product"
                              ? "[Sản phẩm]"
                              : item.lastMessage || ""}
                        </div>
                        <div className="truncate text-11 text-color-500">
                          {getConversationIdentityLabel(item)}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Empty description="Chưa có hội thoại" />
            </div>
          )}
        </div>
      </Card>

      <Card
        className="h-full flex-1 overflow-hidden"
        bodyStyle={{ padding: 0, height: "100%" }}
      >
        {selectedConversation ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-color-300 px-16 py-12">
              <div>
                <div className="text-16 font-medium">
                  {getConversationDisplayName(selectedConversation)}
                </div>
                <div className="text-12 text-color-700">
                  {getConversationIdentityLabel(selectedConversation)}
                </div>
              </div>

              <div className="flex items-center gap-8">
                <Text className="text-13">Bot hỗ trợ</Text>
                <Switch
                  checked={!!selectedConversation.botEnabled}
                  onChange={async (checked) => {
                    if (!selectedConversation?.id) return;

                    try {
                      await disableBotForConversation(
                        selectedConversation.id,
                        checked,
                      );
                      antdMessage.success(
                        checked ? "Đã bật bot hỗ trợ" : "Đã tắt bot hỗ trợ",
                      );
                    } catch (error) {
                      console.error(error);
                      antdMessage.error("Cập nhật bot thất bại");
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-color-200 px-16 py-16">
              {loadingConversation ? (
                <div className="flex h-full items-center justify-center">
                  <Spin />
                </div>
              ) : messages.length ? (
                <>
                  {messages.map(renderMessage)}
                  <div ref={bottomRef} />
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Empty description="Chưa có tin nhắn" />
                </div>
              )}
            </div>

            <div className="border-t border-color-300 p-16">
              <div className="flex items-end gap-12">
                <div className="flex-1">
                  <Input.TextArea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    placeholder="Nhập tin nhắn..."
                    disabled={sending}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        void handleSendText();
                      }
                    }}
                  />
                </div>

                <Space>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={handleUploadImage}
                    disabled={sending}
                  >
                    <Button icon={<PictureOutlined />} disabled={sending} />
                  </Upload>

                  <Button
                    icon={<ProductOutlined />}
                    onClick={openProductModal}
                    disabled={sending}
                  />

                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={sending}
                    disabled={!text.trim() || sending}
                    onClick={handleSendText}
                  >
                    Gửi
                  </Button>
                </Space>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Empty description="Chọn một khách hàng để bắt đầu chat" />
          </div>
        )}
      </Card>

      <Modal
        title="Chọn sản phẩm để gửi"
        open={productModalOpen}
        footer={null}
        width={900}
        onCancel={() => setProductModalOpen(false)}
      >
        <Input
          className="mb-16"
          placeholder="Tìm theo tên hoặc ID sản phẩm"
          value={productKeyword}
          onChange={(e) => setProductKeyword(e.target.value)}
        />

        <div className="max-h-[560px] overflow-y-auto">
          {loadingProducts ? (
            <div className="py-24 text-center">
              <Spin />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-16">
              {filteredProducts.map((item) => (
                <Card
                  key={item.id}
                  size="small"
                  hoverable
                  cover={
                    item.images?.[0] ? (
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="h-[180px] object-cover"
                      />
                    ) : undefined
                  }
                  actions={[
                    <Button
                      type="link"
                      disabled={sending}
                      onClick={() => handleSendProduct(item)}
                    >
                      Gửi sản phẩm
                    </Button>,
                  ]}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="mb-8 text-12 text-color-700">{item.id}</div>
                  <div>
                    Giá lẻ:{" "}
                    {Number(item.variants?.[0]?.prices?.btc || 0).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    ₫
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

const ScreenSupport = memo(Component);

export default ScreenSupport;
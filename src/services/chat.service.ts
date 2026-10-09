import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../firebase";

export type SenderRole = "customer" | "staff" | "bot";
export type MessageType = "text" | "image" | "product" | "system";

export interface ConversationItem {
  id: string;
  customerKey?: string;
  customerUserId?: string | null;
  customerId?: string | null;
  guestSessionId?: string | null;
  customerName?: string | null;
  customerAvatar?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  assignedStaffId?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  participants?: string[];
  lastMessage?: string | null;
  lastMessageType?: MessageType | null;
  lastMessageAt?: any;
  lastSenderId?: string | null;
  unreadCustomer?: number;
  unreadStaff?: number;
  botEnabled?: boolean;
  botPending?: boolean;
  isClosed?: boolean;
  createdAt?: any;
  updatedAt?: any;
  status?: string;
}

export interface ProductSnapshot {
  id: string;
  name: string;
  image?: string;
  category?: string;
  priceBtc?: number;
  priceBtb?: number;
  priceCtv?: number;
}

export interface MessageItem {
  id: string;
  senderId: string;
  senderRole: SenderRole;
  type: MessageType;
  text?: string;
  imageUrl?: string | null;
  product?: ProductSnapshot | null;
  createdAt?: any;
  seenBy?: string[];
  metadata?: Record<string, any>;
}

export interface ProductItem {
  id: string;
  name: string;
  category?: string;
  images?: string[];
  variants?: Array<{
    prices?: {
      btc?: number;
      btb?: number;
      ctv?: number;
    };
  }>;
}

export const subscribeConversations = (
  callback: (items: ConversationItem[]) => void,
): Unsubscribe => {
  const q = query(
    collection(db, "conversations"),
    orderBy("updatedAt", "desc"),
    limit(100),
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      .filter((item: any) => item.isClosed !== true) as ConversationItem[];

    callback(data);
  });
};

export const subscribeMessages = (
  conversationId: string,
  callback: (items: MessageItem[]) => void,
): Unsubscribe => {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as MessageItem[];

    callback(data);
  });
};

export const markConversationReadForStaff = async (conversationId: string) => {
  await updateDoc(doc(db, "conversations", conversationId), {
    unreadStaff: 0,
    updatedAt: serverTimestamp(),
  });
};

export const sendTextMessage = async (params: {
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  text: string;
}) => {
  const { conversationId, senderId, senderRole, text } = params;
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    senderRole,
    type: "text",
    text: trimmed,
    imageUrl: null,
    product: null,
    createdAt: serverTimestamp(),
    seenBy: [senderId],
    metadata: {},
  });

  await updateConversationAfterSend(conversationId, {
    lastMessage: trimmed,
    lastMessageType: "text",
    lastSenderId: senderId,
  });
};

export const sendImageMessage = async (params: {
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  file: File;
}) => {
  const { conversationId, senderId, senderRole, file } = params;

  const filePath = `chat/${conversationId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    senderRole,
    type: "image",
    text: "",
    imageUrl,
    product: null,
    createdAt: serverTimestamp(),
    seenBy: [senderId],
    metadata: {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    },
  });

  await updateConversationAfterSend(conversationId, {
    lastMessage: "[Hình ảnh]",
    lastMessageType: "image",
    lastSenderId: senderId,
  });

  return imageUrl;
};

export const sendProductMessage = async (params: {
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  product: ProductSnapshot;
  text?: string;
}) => {
  const { conversationId, senderId, senderRole, product, text } = params;

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId,
    senderRole,
    type: "product",
    text: text || "Em gửi anh/chị sản phẩm phù hợp",
    imageUrl: null,
    product,
    createdAt: serverTimestamp(),
    seenBy: [senderId],
    metadata: {},
  });

  await updateConversationAfterSend(conversationId, {
    lastMessage: `[Sản phẩm] ${product.name}`,
    lastMessageType: "product",
    lastSenderId: senderId,
  });
};

export const updateConversationAfterSend = async (
  conversationId: string,
  payload: Partial<ConversationItem>,
) => {
  await updateDoc(doc(db, "conversations", conversationId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

export const loadProducts = async (): Promise<ProductItem[]> => {
  const snapshot = await getDocs(collection(db, "Products"));
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as ProductItem[];
};

export const buildProductSnapshot = (product: ProductItem): ProductSnapshot => ({
  id: product.id,
  name: product.name,
  image: product.images?.[0] || "",
  category: product.category || "",
  priceBtc: product.variants?.[0]?.prices?.btc || 0,
  priceBtb: product.variants?.[0]?.prices?.btb || 0,
  priceCtv: product.variants?.[0]?.prices?.ctv || 0,
});

export const disableBotForConversation = async (
  conversationId: string,
  botEnabled: boolean,
) => {
  await updateDoc(doc(db, "conversations", conversationId), {
    botEnabled,
    updatedAt: serverTimestamp(),
  });
};
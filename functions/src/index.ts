import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";

admin.initializeApp();

const db = admin.firestore();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const autoReplyBot = functions.firestore
  .document("conversations/{conversationId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { conversationId, messageId } = context.params;

    if (!message) return;
    if (message.senderRole !== "customer") return;

    const conversationRef = db.collection("conversations").doc(conversationId);

    const conversationDoc = await conversationRef.get();
    const conversation = conversationDoc.data();

    if (!conversation?.botEnabled) return;
    if (conversation?.isClosed) return;

    await conversationRef.set(
      {
        botPending: true,
        pendingMessageId: messageId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await new Promise((resolve) => setTimeout(resolve, 30000));

    const freshConversationDoc = await conversationRef.get();
    const freshConversation = freshConversationDoc.data();

    if (!freshConversation?.botEnabled || freshConversation?.isClosed) {
      await conversationRef.set(
        {
          botPending: false,
          pendingMessageId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    if (freshConversation?.pendingMessageId !== messageId) {
      return;
    }

    const latestMessagesSnap = await db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(8)
      .get();

    const latestMessages = latestMessagesSnap.docs.map((d) => d.data());
    const latestMessage = latestMessages[0];

    if (!latestMessage || latestMessage.senderRole !== "customer") {
      await conversationRef.set(
        {
          botPending: false,
          pendingMessageId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const transcript = latestMessages
      .slice()
      .reverse()
      .map((item: any) => {
        const content =
          item.type === "text"
            ? item.text || ""
            : item.type === "image"
              ? "[Hình ảnh]"
              : item.type === "product"
                ? `[Sản phẩm] ${item.product?.name || ""}`
                : `[${item.type}]`;

        return `${item.senderRole}: ${content}`;
      })
      .join("\n");

    const response = await client.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content:
            "Bạn là trợ lý CSKH của cửa hàng thiết bị phòng tắm. Trả lời ngắn gọn, lịch sự, tự nhiên bằng tiếng Việt. Ưu tiên giải đáp về sản phẩm, giá, bảo hành, tình trạng hàng. Nếu không chắc, mời khách để lại số điện thoại hoặc chờ nhân viên tư vấn.",
        },
        {
          role: "user",
          content: `Lịch sử chat:\n${transcript}\n\nHãy trả lời tin nhắn mới nhất của khách hàng.`,
        },
      ],
    });

    const replyText = response.output_text?.trim();

    if (!replyText) {
      await conversationRef.set(
        {
          botPending: false,
          pendingMessageId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    await db
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .add({
        senderId: "bot_support",
        senderRole: "bot",
        type: "text",
        text: replyText,
        imageUrl: null,
        product: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        seenBy: [],
        metadata: {},
      });

    await conversationRef.set(
      {
        lastMessage: replyText,
        lastMessageType: "text",
        lastSenderId: "bot_support",
        botPending: false,
        pendingMessageId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

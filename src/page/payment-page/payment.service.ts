import dayjs from "dayjs";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import type { PaymentDoc, PaymentStatus } from "../screen-manage-cart/order.types";

export const sortByCreatedDesc = <T extends { createdAt?: string }>(items: T[]) =>
  [...items].sort(
    (a, b) =>
      dayjs(b.createdAt || 0).valueOf() - dayjs(a.createdAt || 0).valueOf(),
  );

export const subscribePayments = (callback: (payments: PaymentDoc[]) => void) => {
  const q = query(collection(db, "Payments"), orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as PaymentDoc[];

    callback(sortByCreatedDesc(data));
  });
};

export const updatePaymentStatus = async (paymentId: string, status: PaymentStatus) => {
  await updateDoc(doc(db, "Payments", paymentId), {
    status,
    paidAt: status === "PAID" ? dayjs().toISOString() : null,
  });
};
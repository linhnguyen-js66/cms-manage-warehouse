import dayjs from "dayjs";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase";

export type ProductReviewDoc = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  idUser: string;
  userName: string;
  userEmail?: string;
  rating: number;
  content: string;
  imageUrls: string[];
  status: "VISIBLE" | "HIDDEN";
  createdAt: string;
  updatedAt: string;
  staffReply?: {
    content: string;
    staffId: string;
    staffName: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export const subscribeAllProductReviews = (
  callback: (reviews: ProductReviewDoc[]) => void,
) => {
  const q = query(collection(db, "ProductReviews"));

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data(),
      })) as ProductReviewDoc[];

    data.sort(
      (a, b) =>
        dayjs(b.createdAt || 0).valueOf() - dayjs(a.createdAt || 0).valueOf(),
    );

    callback(data);
  });
};

export const getProductReviewsByProductId = async (productId: string) => {
  const q = query(
    collection(db, "ProductReviews"),
    where("productId", "==", productId),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    })) as ProductReviewDoc[];
};

export const replyProductReview = async (params: {
  reviewId: string;
  content: string;
  staffId: string;
  staffName: string;
}) => {
  const now = dayjs().toISOString();

  await updateDoc(doc(db, "ProductReviews", params.reviewId), {
    staffReply: {
      content: params.content.trim(),
      staffId: params.staffId,
      staffName: params.staffName,
      createdAt: now,
      updatedAt: now,
    },
    updatedAt: now,
  });
};

export const toggleProductReviewVisible = async (
  reviewId: string,
  status: "VISIBLE" | "HIDDEN",
) => {
  await updateDoc(doc(db, "ProductReviews", reviewId), {
    status,
    updatedAt: dayjs().toISOString(),
  });
};
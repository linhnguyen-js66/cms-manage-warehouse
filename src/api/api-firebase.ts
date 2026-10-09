import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

export const uploadTransactions = async (data: any[]) => {
  const colRef = collection(db, "transactions");
  for (const item of data) {
    await addDoc(colRef, item);
  }

  return true;
};

export const getTransactions = async () => {
  const colRef = collection(db, "transactions");
  const snapshot = await getDocs(colRef);

  const result = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return result;
};
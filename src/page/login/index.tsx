import { Button, Form, Input } from "antd";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { get } from "lodash";
// import { useRouter } from 'next/navigation';
import { useCallback } from "react";
import { useDispatch } from "react-redux";

// import { IconSvgLocal } from '@/components';
import { showDialog } from "@/components/dialog";
import { hideLoading, showLoading } from "../loading";
import { setUserInfo } from "@/store/login";
import { auth, db } from "../../../firebase";

export default function LoginPage() {
  const dispatch = useDispatch();

  const getUserInfo = async (userId: string) => {
    const q = query(collection(db, "Users"), where("uid", "==", userId));

    const snapshot = await getDocs(q);

    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return users?.[0];
  };
  const onLogin = useCallback(
    (data: any) => {
      const email = get(data, "username", "");
      const password = get(data, "password", "");

      showLoading();
      signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const { user } = userCredential;
          const info = await getUserInfo(user?.uid);
          if (!info?.role || info?.role?.length == 0) {
            showDialog({
              title: "Lỗi hệ thống",
              image: {
                width: 80,
                height: 80,
              },
              content:
                "Tài khoản chưa được cấp quyền truy cập. Vui lòng liên hệ ADMIN để được cấp quyền!",
              actions: [
                {
                  title: "Đóng",
                  type: "primary",
                  onPress: async () => {
                    console.log("Đăng xuất do không có quyền truy cập");
                    await signOut(auth);
                    dispatch(setUserInfo(null));
                  },
                },
              ],
            });
            return;
          }
          dispatch(
            setUserInfo({
              uid: user?.uid,
              ...info,
            }),
          );
        })
        .catch((error) => {
          const errorCode = error.code;
          if (errorCode == "auth/invalid-credential") {
            showDialog({
              title: "Lỗi hệ thống",
              image: {
                name: "IC_AUTHEN_ERROR",
                width: 80,
                height: 80,
                fill: "text-error-500",
              },
              content:
                "Tài khoản hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!",
              actions: [
                {
                  title: "Thử lại",
                  type: "secondary",
                },
              ],
            });
          }
          if (errorCode == "auth/invalid-email") {
            showDialog({
              title: "Lỗi hệ thống",
              image: {
                name: "IC_AUTHEN_ERROR",
                width: 80,
                height: 80,
                fill: "text-error-500",
              },
              content:
                "Người dùng không tồn tại. Vui lòng liên hệ ADMIN để được tạo mới tài khoản!",
              actions: [
                {
                  title: "Thử lại",
                  type: "secondary",
                },
              ],
            });
          }
        })
        .finally(() => {
          hideLoading();
        });
    },
    [auth],
  );
  return (
    <div className="flex min-h-screen items-center justify-center bg-link-200">
      <div className="flex w-full max-w-xs flex-col rounded-radius-l bg-color-100 p-32 text-center shadow-down-xs shadow-color-200 mobile:max-w-sm">
        {/* <IconSvgLocal name="IC_LOGO_TP" classNames="h-[80px] mb-16" /> */}
        <h1 className="mb-16 text-20">Đăng nhập</h1>

        <Form
          name="login"
          onFinish={onLogin}
          layout="vertical"
          className="text-left"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "Vui lòng nhập tài khoản!" },
              { type: "email", message: "Email không đúng định dạng!" },
            ]}
          >
            <Input
              placeholder="Tài khoản"
              className="px-10 text-14 leading-20"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
          >
            <Input.Password
              placeholder="Mật khẩu"
              className="px-10 text-14 leading-20"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="py-10 rounded-radius-s hover:opacity-90 w-full text-14 font-semibold leading-20 text-common-1000 transition-opacity"
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <div className="mt-spacing-12 text-center">
          <a
            href="#"
            className="text-primary text-14 leading-20 hover:underline"
          >
            Quên mật khẩu?
          </a>
        </div>
      </div>
    </div>
  );
}

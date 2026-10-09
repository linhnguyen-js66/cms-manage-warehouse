import * as React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, theme as antTheme, Menu, Button } from "antd";
import ReactSvg from "@/assets/svg/logoNT.png";
import { useEffect, useState } from "react";
import {
  CommentOutlined,
  PoweroffOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { getUserInfo, setUserInfo } from "@/store/login";
import { getAuth, signOut } from "firebase/auth";
import { isPermited } from "@/utils/common";
import { ROLE } from "@/constant";

const { Sider, Content, Header } = Layout;

function LayoutSaving() {
  const { userInfo } = useSelector(getUserInfo);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const dispatch = useDispatch();

  const tokenAntd = antTheme.useToken();
  const location = useLocation();
  const navigate = useNavigate();

  const items: any[] = React.useMemo(() => {
    return [
      isPermited([
        ROLE.ADMIN,
        ROLE.CREATE_PRODUCT,
        ROLE.VIEW,
        ROLE.CREATE_CUSTOMER,
      ]) && {
        key: "/",
        label: "La bàn dữ liệu",
      },
      isPermited([ROLE.ADMIN, ROLE.CREATE_PRODUCT, ROLE.VIEW]) && {
        key: "/product",
        label: "Quản lý sản phẩm",
      },
      isPermited([ROLE.ADMIN, ROLE.CREATE_CUSTOMER, ROLE.VIEW]) && {
        key: "/customer",
        label: "Quản lý khách hàng",
      },
      isPermited([ROLE.ADMIN, ROLE.VIEW]) && {
        key: "/provider",
        label: "Quản lý nhà cung cấp",
      },
      isPermited([ROLE.ADMIN, ROLE.VIEW]) && {
        key: "/promotion",
        label: "Khuyến mại",
      },
      isPermited([ROLE.ADMIN, ROLE.VIEW]) && {
        key: "/cart",
        label: "Vận đơn",
      },
      isPermited([ROLE.ADMIN, ROLE.VIEW]) && {
        key: "/payment",
        label: "Trạng thái thanh toán",
      },
      isPermited([ROLE.ADMIN, ROLE.VIEW]) && {
        key: "/rating",
        label: "Điểm cửa hàng",
      },
    ];
  }, []);

  const onMenuClick = (path: string) => {
    navigate(path);
  };

  useEffect(() => {
    const rootKey = `/${location.pathname.split("/")[1]}`;
    setOpenKeys([rootKey]);
  }, [location.pathname]);

  const onOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  const logoutFirebase = async () => {
    const auth = getAuth();

    try {
      await signOut(auth);
      dispatch(
        setUserInfo(null),
      );
      console.log("Đã đăng xuất Firebase!");
    } catch (error) {
      console.error("Lỗi logout:", error);
    }
  };
  // const getDetailUser = React.useCallback(async () => {
  //   const token = localStorage.getItem("token");
  //   if (token) {
  //     const result = decodeToken(token!);
  //     try {
  //       const response = (await detailUser({
  //         userName: result?.preferred_username,
  //       })) as any;

  //       if (response?.user?.status != "ACTIVE") {
  //         navigate("/error");
  //         return;
  //       }
  //     } catch (error) {
  //       navigate("/error");
  //     }
  //   }
  // }, []);

  // useEffect(() => {
  //   getDetailUser();
  // }, [getDetailUser]);
  return (
    <Layout style={{ height: "100%" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: tokenAntd.token.colorBgContainer,
        }}
      >
        <div className="logo" style={{ width: 200 }}>
          <img
            src={ReactSvg}
            alt=""
            style={{
              marginRight: "20px",
              width: "50px",
              height: "50px",
            }}
          />
        </div>
        <div>
          <Button
            className="text-18"
            icon={<CommentOutlined />}
            type="text"
            onClick={() => navigate("/support")}
          >
            Tin nhắn từ khách hàng
          </Button>
          <Button
            className="text-18"
            icon={<PoweroffOutlined />}
            type="text"
            onClick={logoutFirebase}
          >
            {userInfo?.name || userInfo?.email}
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider style={{ backgroundColor: tokenAntd.token.colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            openKeys={openKeys}
            onOpenChange={onOpenChange}
            onClick={(e) => onMenuClick(e.key)}
            items={items}
          />
        </Sider>
        <Layout>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
export default LayoutSaving;

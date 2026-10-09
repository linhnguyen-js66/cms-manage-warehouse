import { FC } from "react";
import { Result, Button, Modal } from "antd";
import { RouteProps, useLocation } from "react-router";

const PrivateRoute: FC<RouteProps | unknown> = (props) => {
  return (
    <Result
      status="403"
      className="bg-color-50 h-full w-full"
      title="Quyền truy cập"
      subTitle={
        "Người dùng không có quyền truy cập tính năng này. Vui lòng thử lại sau"
      }
      {...props}
    />
  );
};

export default PrivateRoute;

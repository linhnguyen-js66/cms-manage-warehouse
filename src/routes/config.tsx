import { FC, ReactElement, useEffect, useState } from "react";
import { RouteProps } from "react-router";
import PrivateRoute from "./pravateRoute";
import { useIntl } from "react-intl";
import { Button } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { getUserInfo } from "@/store/login";

export interface WrapperRouteProps extends RouteProps {
  /** document title locale id */
  titleId: string;
  /** authorization？ */
  auth?: boolean;
  requiredRoles?: string[];
}

const WrapperRouteComponent: FC<WrapperRouteProps> = ({
  titleId = "",
  auth = false,
  requiredRoles = [],
  ...props
}) => {
  const { formatMessage } = useIntl();
  const [roles, setRoles] = useState<string[]>([]);
  const {userInfo} = useSelector(getUserInfo);
  const dispatch = useDispatch();
  const getUserDetails = async () => {
    // const token = localStorage.getItem("token");
    // const data = decodeToken(token!);
    // if (!data?.preferred_username) return;
    // const userRoles = data.realm_access?.roles || [];
    // dispatch(
    //   setInfoUser({
    //     name: data?.preferred_username,
    //     fullName: data?.given_name,
    //     email: data?.email,
    //   })
    // );
    // setRoles(userRoles);
  };
  useEffect(() => {
    // getUserDetails();
  }, []);
  //const isAdmin = roles.includes(ROLE_KEYCLOAK.ADMIN);
  const hasRequiredRole = true
    //isAdmin || requiredRoles.some((role) => roles.includes(role));

  if (titleId) {
    document.title = formatMessage({
      id: titleId,
    });
  }

  if (!userInfo || !userInfo) {
    return (
      <PrivateRoute
        extra={
          <Button type="primary" onClick={() => {}}>
            {/* Về đăng nhập */}
          </Button>
        }
      />
    );
  }

  return !hasRequiredRole ? <PrivateRoute /> : (props.element as ReactElement);
};

export default WrapperRouteComponent;

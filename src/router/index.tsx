import ErrorPage from "@/page/errorPage";
import Nav from "@/page/navbar";
import { createBrowserRouter } from "react-router-dom";
import React from "react";
import { ManageProduct } from "@/page/screen-manage-product";
import LoginPage from "@/page/login";
import { isPermited } from "@/utils/common";
import { ROLE } from "@/constant";
import { DetailProduct } from "@/page/screen-detail-product";
import { ManageCustomer } from "@/page/screen-customer-manage";
import { ManageProvider } from "@/page/screen-provider-manage";
import { ManagePromotion } from "@/page/screen-manage-promotion";
import { ManageCart } from "@/page/screen-manage-cart";
import ChatConversationMockup from "@/page/screen-support";
import { AddPromotion } from "@/page/screen-manage-promotion/add-promo";
import DashboardPage from "@/page/dashboard";
import AdminProductReviewsPage from "@/page/product-review";
import AdminPaymentsPage from "@/page/payment-page";

const ProtectedRoute = ({
  element,
  requiredRoles = [],
}: {
  element: any;
  requiredRoles?: string[];
  titleId: string;
}) => {
  const hasRequiredRole = isPermited(requiredRoles);
  return hasRequiredRole ? element : <ErrorPage isLogout={false} />;
};

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Nav />,
      errorElement: <ErrorPage />,
      children: [
        {
          path: "/",
          index: true,
          element: (
            <ProtectedRoute
              element={<DashboardPage />}
              titleId="Dashboard"
              requiredRoles={[
                ROLE.VIEW,
                ROLE.ADMIN,
                ROLE.CREATE_PRODUCT,
                ROLE.CREATE_CUSTOMER,
              ]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/rating",
          index: true,
          element: (
            <ProtectedRoute
              element={<AdminProductReviewsPage />}
              titleId="Dashboard"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
                {
          path: "/payment",
          index: true,
          element: (
            <ProtectedRoute
              element={<AdminPaymentsPage />}
              titleId="Dashboard"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/product",
          index: true,
          element: (
            <ProtectedRoute
              element={<ManageProduct />}
              titleId="Quản lý sản phẩm"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN, ROLE.CREATE_PRODUCT]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/customer",
          index: true,
          element: (
            <ProtectedRoute
              element={<ManageCustomer />}
              titleId="Quản lý khách hàng"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN, ROLE.CREATE_PRODUCT]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/detail/product",
          index: true,
          element: (
            <ProtectedRoute
              element={<DetailProduct />}
              titleId="Chi tiết sản phẩm"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN, ROLE.CREATE_PRODUCT]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/provider",
          index: true,
          element: (
            <ProtectedRoute
              element={<ManageProvider />}
              titleId="Quản lý nhà cung cấp"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN, ROLE.CREATE_PRODUCT]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/promotion",
          index: true,
          element: (
            <ProtectedRoute
              element={<ManagePromotion />}
              titleId="Quản lý nhà khuyến mãi"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/cart",
          index: true,
          element: (
            <ProtectedRoute
              element={<ManageCart />}
              titleId="Quản lý vận đơn"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/support",
          index: true,
          element: (
            <ProtectedRoute
              element={<ChatConversationMockup />}
              titleId="Trò chuyện"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/promotion/add-promotion",
          index: true,
          element: (
            <ProtectedRoute
              element={<AddPromotion />}
              titleId="Thêm mới khuyến mãi"
              requiredRoles={[ROLE.VIEW, ROLE.ADMIN]}
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
      ],
    },

    {
      path: "/error",
      element: <ErrorPage />,
    },
    {
      path: "/login",
      element: <LoginPage />,
    },
  ],
  {
    basename: "/",
  },
);

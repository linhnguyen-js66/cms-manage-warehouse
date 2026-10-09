import { Box, Typography } from "@mui/material";
import { Button, Result } from "antd";
// import { logoutService } from "@/api/login";
interface Iprops {
  isLogout?: Boolean;
}
const ErrorPage = (props: Iprops) => {
  const { isLogout = true } = props;
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#fff",
      }}
    >
      <Typography className="flex flex-col">
        <Result
          status="403"
          className="bg-color-50 h-full w-full"
          title="Quyền truy cập"
          subTitle={
            "Người dùng không có quyền truy cập tính năng này. Vui lòng thử lại sau"
          }
        />
        {isLogout && (
          <Button type="primary" onClick={() => {}}>
            Về đăng nhập
          </Button>
        )}
      </Typography>
    </Box>
  );
};

export default ErrorPage;

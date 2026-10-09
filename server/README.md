# Server GHN mới cho React CMS

Flow: nhập đơn khách đặt qua Zalo → React gọi server → server tạo vận đơn GHN → trả mã vận đơn. Token GHN được giữ trên server. Bộ này thay adapter SPX bằng GHN, dùng tài liệu tại https://developer.ghn.vn/vi/docs.

## Bản mới này

Đối chiếu endpoint, HTTP method, header và payload với https://developer.ghn.vn/vi/docs ngày 06/10/2026. `/api/ghn/...` là route nội bộ của CMS; không phải URL do GHN công bố. Server chuyển tiếp sang `/shiip/public-api/...` trên gateway chính thức.

- Địa chỉ mới: tỉnh → phường/xã; tạo đơn bằng tên và cờ `is_new_to_address:true`.
- Tạo đơn, preview, tra cứu, hủy, cập nhật, COD, in và danh mục đã có trong bảng API bên dưới.
- In đơn chấp nhận tối đa 10.000 mã theo tài liệu; các thao tác lô khác giới hạn nội bộ 1.000 mã.
- Mặc định `.env.example` là GHN production. Chỉ chọn staging với token và shop của môi trường thử nghiệm.
- Folder mới dùng SQLite riêng tại `server-ghn/data/`; không chép database cũ nếu muốn bắt đầu tập đơn mới.
- Chưa thay đổi component order của React và chưa gửi đơn thật.

## Chạy trong project React

Giải nén và đặt thư mục `server-ghn/` cạnh `src/`, `package.json` của React. Cần **Node.js 24 trở lên**; server dùng thư viện chuẩn Node và SQLite, không cần npm install.

```bash
cd server-ghn
cp .env.example .env
# Điền các biến trong .env rồi chạy:
yarn dev
```

Cấu hình:

| Biến | Giá trị |
| --- | --- |
| ADMIN_PASSWORD | Mật khẩu quản trị riêng, tối thiểu 16 ký tự |
| GHN_TOKEN | Token API tài khoản GHN |
| GHN_SHOP_ID | ID cửa hàng/kho GHN |
| GHN_ENV | `staging` để thử; `production` để tạo đơn thật |
| FRONTEND_ORIGIN | Origin React, mặc định `http://localhost:5173` |
| SHIPPING_PROVIDER | `ghn`; `mock` chỉ dùng thử local |

Lấy token theo https://developer.ghn.vn/vi/docs/token/get-token. Token và Shop ID phải cùng môi trường: cổng production https://khachhang.ghn.vn và cổng thử https://khachhang.ghn.dev. Nếu chưa biết Shop ID, điền token, khởi động server, đăng nhập rồi gọi `GET /api/ghn/shops?offset=0&limit=50`; endpoint này chưa cần cấu hình Shop ID. Điền ID rồi khởi động lại.

Không đưa token/mật khẩu vào `VITE_*`, mã React hoặc git. `.env` và `data/` đã có trong `.gitignore`. Thư mục `data/` chứa thông tin khách và đơn; cần sao lưu và hạn chế quyền đọc.

## Kết nối React

Copy `examples/react-api.js` và `examples/CreateShipment.jsx` vào React để dùng form mẫu. Đây là ví dụ độc lập, chưa gắn vào màn hình CMS của bạn. Form gửi địa chỉ mới theo tỉnh + phường/xã; kho lấy hàng mặc định là shop đã đăng ký với GHN.

```js
import { createShippingApi } from './react-api.js';
const api = createShippingApi('http://localhost:3001');
await api.login(password); // cookie HttpOnly, thời hạn 8 giờ
const shipment = await api.createShipment(order); // xem examples/order.json
console.log(shipment.trackingNumber);
const labels = await api.print([shipment.trackingNumber]);
console.log(labels.printUrls.A5); // URL in nhãn
```

`POST /api/shipments` nhận định dạng camelCase trong `examples/order.json`; `sender` tùy chọn, thiếu sẽ dùng kho GHN. `recipient.address.isNewAddress` mặc định true. Địa chỉ cũ cần false và district. Khối lượng dùng gram, kích thước cm, tiền VND số nguyên. Có thể thêm `ghn: {serviceTypeId: 2, requiredNote: 'KHONGCHOXEMHANG', insuranceValue: 0, coupon: '', pickShift: []}`. Từ 20kg chọn dịch vụ 5 và khai khối lượng/kích thước cho từng item qua `item.parcel`.

`POST /api/ghn/orders/create` nhận trực tiếp payload snake_case GHN; xem `examples/order-ghn.json`. Cả hai cách tạo đều được lưu SQLite và chống gửi trùng. Không đổi định dạng payload giữa hai endpoint khi gửi lại cùng mã.

## API đã triển khai

Tất cả API dưới đây cần đăng nhập. `ghnPost(path,payload)` / `ghnGet(path,query)` trong helper React nhận đường dẫn sau `/api/ghn/`. Gateway trả nguyên cấu trúc `{code,message,data}` GHN; riêng create trả trạng thái lưu tại server và mã vận đơn. Print bổ sung `printUrls`.

| Method | Endpoint server | Nội dung đầu vào chính |
| --- | --- | --- |
| POST | /api/auth/login | `{password}` |
| POST | /api/auth/logout | `{}` |
| POST | /api/shipments | Đơn camelCase |
| GET | /api/shipments/:referenceId | Kết quả gửi lưu tại server |
| POST | /api/shipments/:referenceId/reconcile | `{}`; đối soát GHN theo mã CMS |
| POST | /api/ghn/orders/create | Payload tạo đơn GHN |
| POST | /api/ghn/orders/update | `order_code` + các trường cập nhật theo GHN |
| POST | /api/ghn/orders/update-cod | `order_code, cod_amount` (0–5 triệu) |
| POST | /api/ghn/orders/cancel | `order_codes: [...]` |
| POST | /api/ghn/orders/return | `order_codes: [...]` |
| POST | /api/ghn/orders/redeliver | `order_codes: [...]` |
| POST | /api/ghn/orders/print | `order_codes: [...]` |
| GET | /api/ghn/orders/detail | Query `order_code` |
| GET | /api/ghn/orders/by-client-code | Query `client_order_code` |
| POST | /api/ghn/orders/preview | Payload tạo đơn; mã CMS tùy chọn; không tạo đơn |
| POST | /api/ghn/orders/leadtime | `to_district_id, to_ward_code` + trường theo GHN |
| POST | /api/ghn/orders/calculate-fee | `to_district_id, to_ward_code, weight, service_type_id` + trường theo GHN |
| GET | /api/ghn/orders/fees | Query `order_code`; phí thực tế |
| GET | /api/ghn/master/provinces | Danh sách tỉnh cũ |
| GET | /api/ghn/master/districts | Query `province_id` |
| GET | /api/ghn/master/wards | Query `district_id` |
| GET | /api/ghn/master/provinces-new | Query tùy chọn `offset, limit` |
| GET | /api/ghn/master/wards-new | Query `province_id`, tùy chọn `offset, limit` |
| GET | /api/ghn/master/stations | Query `district_id`, tùy chọn `ward_code, offset, limit` |
| POST | /api/ghn/master/services | `from_district, to_district`; shop_id lấy từ server |
| GET | /api/ghn/master/pick-shifts | Ca lấy hàng |
| GET | /api/ghn/master/statuses | Danh mục tham khảo tĩnh từ tài liệu GHN |
| GET | /api/ghn/master/reasons | Mã lý do theo nhóm; canSendToCancel đánh dấu lý do shop hủy |
| GET | /api/ghn/shops | Query tùy chọn `offset, limit, client_phone` |

Hai trang mã trạng thái và mã lý do trong ảnh là danh mục tài liệu, không phải API GHN để gọi mạng. Bộ này cung cấp danh mục trạng thái và mã lý do theo nhóm. Nội dung chi tiết của từng lý do lấy từ trường Reason trong callback GHN hoặc liên kết tài liệu trong response. Chấp nhận mã mới khi GHN bổ sung.

**Địa chỉ mới:** API create/preview nhận tên tỉnh và phường/xã cùng `is_new_to_address:true`. Các API fee/leadtime/services vẫn dùng mã quận/huyện và mã phường theo tài liệu riêng. Không truyền ID địa chỉ mới thay cho ID cũ. Với form địa chỉ mới, dùng preview để kiểm tra đơn và phí trước khi tạo.

**Cập nhật COD:** update-cod là API riêng với giới hạn 5 triệu. Nếu gửi cod_amount qua update tổng quát, GHN yêu cầu otp; server kiểm tra có otp. Các API hủy/hoàn/giao lại có kết quả từng đơn; phải kiểm tra `result` trong data, không coi HTTP 200 là toàn bộ đơn thành công. Preview hiện dùng validator của luồng CMS; giới hạn số items/số lượng là giới hạn nội bộ, không phải giới hạn công bố của GHN. Điểm gửi có thể bị GHN yêu cầu xác minh theo tài khoản; server trả lỗi và không tự vượt xác minh.

## Chống trùng và lỗi kết nối

Đây là quy tắc riêng của server để lưu/tra cứu và chống gửi trùng; GHN chỉ quy định mã tối đa 50 ký tự. Dùng mã CMS duy nhất 8–50 ký tự chữ/số/`_`/`-` làm referenceId hoặc client_order_code. GHN nhận mã này; server cũng lưu bền vào SQLite, phân biệt shop và môi trường.

- CREATED: đã nhận mã vận đơn; gửi lại cùng dữ liệu trả đơn cũ.
- SUBMITTING: đang gửi; không gửi đồng thời lần nữa.
- REJECTED: GHN trả lỗi 4xx rõ ràng; sửa dữ liệu rồi gửi lại cùng mã được phép.
- UNKNOWN: timeout/kết quả không xác định; không tự retry và không tạo mã mới. Gọi reconcile để tìm theo mã CMS. Nếu tìm được, server lưu mã vận đơn; nếu không tìm được, giữ nguyên trạng thái để đối soát tiếp với GHN.

Sau server restart có thể đối soát SUBMITTING còn dở. Trạng thái trên là **kết quả gửi**, không phải trạng thái giao hàng. Tra cứu `/api/ghn/orders/detail` để xem trạng thái giao mới nhất; bản này chưa có webhook. Các thao tác update/hủy qua gateway không sửa snapshot đơn gốc trong SQLite.

Chạy một instance server với một DB. Khi triển khai, dùng reverse proxy HTTPS cùng origin React, `NODE_ENV=production`, `FRONTEND_ORIGIN=https://...`; helper React đặt baseURL rỗng để gọi `/api`. Session mất khi server restart nên cần đăng nhập lại.

## Kiểm tra

```bash
npm test
```

10 test sử dụng GHN giả lập: mapping payload, headers/môi trường, các route, chống trùng, giữ lỗi từng đơn, token không lọt lỗi, timeout/đối soát, lưu bền khi restart và xác thực HTTP. Chưa tạo đơn thực tế vì chưa có token/Shop ID của bạn.

Nguồn: tài liệu chính thức https://developer.ghn.vn/vi/docs, https://developer.ghn.vn/vi/docs/order/create, https://developer.ghn.vn/vi/docs/order/info-by-client-code và các trang API được liên kết trong menu.

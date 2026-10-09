// Reference lists from official GHN docs; unknown future codes remain valid upstream.
export const cancelReasons = [
  { code: 'GHN-CO001', label: 'Lấy hàng chậm' },
  { code: 'GHN-CO002', label: 'Chưa có hàng' },
  { code: 'GHN-CO003', label: 'Khách huỷ mua' },
  { code: 'GHN-CANCEL-OTHER', label: 'Khác' },
];
export const orderStatuses = Object.entries({
  ready_to_pick: 'Chờ lấy', picking: 'Đang lấy', money_collect_picking: 'Thu tiền lấy hàng',
  picked: 'Đã lấy', storing: 'Tại kho', sorting: 'Phân loại', transporting: 'Vận chuyển',
  delivering: 'Đang giao', money_collect_delivering: 'Thu tiền giao hàng', delivered: 'Đã giao',
  delivery_fail: 'Giao thất bại', waiting_to_return: 'Chờ hoàn', return: 'Yêu cầu hoàn',
  return_transporting: 'Vận chuyển hoàn', return_sorting: 'Phân loại hoàn', returning: 'Đang hoàn',
  return_fail: 'Hoàn thất bại', returned: 'Đã hoàn', cancel: 'Đã huỷ', exception: 'Sự cố',
  lost: 'Thất lạc', damage: 'Hư hỏng', scrap: 'Tiêu huỷ',
}).map(([code, label]) => ({ code, label }));

// Category labels are local UI summaries; use GHN callback Reason for exact details.
export const reasonCodes = [
  ...cancelReasons.map(row => ({ ...row, group: 'sender-cancel', canSendToCancel: true })),
  ...Object.entries({
    'pickup-failed': ['GHN-PFA1A0','GHN-PFA1A1','GHN-PFA2A1','GHN-PFA2A2','GHN-PFA2A3','GHN-PFA3A2','GHN-PFA3A4','GHN-PFA3A5','GHN-PFA3A6','GHN-PFA3A7','GHN-PFA3A8','GHN-PFA3A9','GHN-PFA3A10','GHN-PFA3A11','GHN-PFA4A1','GHN-PFA4A2','GHN-PFC1A8','GHN-PFC1A9'],
    'pickup-cancelled': ['GHN-PCB0B1','GHN-PCB0B2'],
    'delivery-failed': ['GHN-DFC1A0','GHN-DFC1A1','GHN-DFC1A2','GHN-DFC1A4','GHN-DFC1A6','GHN-DFC1A7','GHN-DFC1A9','GHN-DFC2A0','GHN-DFC2A1'],
    'recipient-refused': ['GHN-DCD0A1','GHN-DCD0A5','GHN-DCD0A6','GHN-DCD0A7','GHN-DCD0A8','GHN-DCD1A1','GHN-DCD1A5'],
    'return-failed': ['GHN-RFE0A0','GHN-RFE0A1','GHN-RFE0A3','GHN-RFE0A4','GHN-RFE0A5','GHN-RFE0A6','GHN-RFE0A7','GHN-RFE0A8'],
    redelivery: ['GHN-RDAI01','GHN-RDC001'],
  }).flatMap(([group, codes]) => codes.map(code => ({ code, group, canSendToCancel: false }))),
];

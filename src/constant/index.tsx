export const ROLE = {
  CREATE_CUSTOMER:"ROLE/CREATE_CUSTOMER",
  CREATE_PRODUCT:"ROLE/CREATE_PROD",
  VIEW:"ROLE/VIEW",
  ADMIN:"ROLE/ADMISTRATOR"
}

export const LEVEL_CUSTOMER = {
  BTC:"Khách lẻ",
  BTB: 'Khách sỉ',
  CTV: 'Cộng tác viên'
}

export const STATUS_CUSTOMER = {
  ACTIVE: 'Hoạt động',
  PENDING: 'Chờ duyệt',
  INACTIVE: 'Không hoạt động'
}

export const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  ACTIVE: "green",
  INACTIVE: "red",
};
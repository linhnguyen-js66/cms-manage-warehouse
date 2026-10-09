export const RESPONSE_STATUS = {
  SUCCESS: 200,
};

export const paginationDefault = {
  page: 1,
  size: 10,
};
export const pageSizeOptions = [20, 50, 100];
export const PAGE_DEFAULT = 2;

export function formatPhone(phoneNumber: string) {
  if (phoneNumber) {
    phoneNumber = phoneNumber.replaceAll(' ', '');
    if (phoneNumber.length != 10) {
      return phoneNumber;
    }
    const match = phoneNumber.replace(/^(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    return match;
  } else {
    return phoneNumber;
  }
}

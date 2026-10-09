export interface CustomerParams {
  pageNum: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
  cif?: string;
  partner?: number;
  idNumber?: string;
  customerName?: string;
  phone?: string;
  status?: number;
}

export interface CustomerParamsNoPage {
  startDate?: string;
  endDate?: string;
  cif?: string;
  partner?: number;
  idNumber?: string;
  customerName?: string;
  phone?: string;
  status?: number;
}

export interface Customer {
  id: number;

  customerName: string;

  cif: string;

  idNumber: string;

  phone: string;

  applyDate: string;

  endDate: string;

  suggestedLimit: number;

  suggestedTime: number;

  presenter: string;

  status: Status;

  partner: Partner;

  leadCustomer: LeadCustomer;

  createdDate: string;
}

export interface Status {
  code: string;
  name: string;
}

export interface Partner {
  partnerName: string;
  partnerId: number;
}

export interface LeadCustomer {
  status: string;
}
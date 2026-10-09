export interface Role {
  name: string;
  key: string;
  children?: any;
}

export type GetRoleResult = Role[];

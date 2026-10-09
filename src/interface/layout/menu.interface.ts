interface MenuItem {
  code: string;
  label: string;
  icon?: string;
  path: string;
  children?: MenuItem[];
  permission?: Array<any>;
}

export type MenuChild = Omit<MenuItem, 'children'>;

export type MenuList = MenuItem[];

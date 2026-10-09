import { MenuList } from '@/interface/layout/menu.interface';
import { intercepter, mock } from '../config';

export const mockMenuList: MenuList = [
  {
    code: 'dashboard',
    label: 'Dashboard',
    icon: 'permission',
    path: '/dashboard',
    permission: [

    ],
    children: [
      {
        code: 'truyvanKhoSo',
        label: 'Truy vấn kho số',
        path: '/kho-so/truy-van',
      }
    ],
    
  },
];

mock.mock('/user/menu', 'get', intercepter(mockMenuList));

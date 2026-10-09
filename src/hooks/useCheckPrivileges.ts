import { mockMenuList } from '@/mock/user/menus.mock';
import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

const useCheckPrivileges = () => {
  const { role, infoUser } = useSelector(state => state.user);

  const checkPrivileges = (privileges: string) => {
    const find = role.find(e => e.privilege === privileges);
    if (find) {
      return true;
    } else {
      return false;
    }
  };

  const menuForRole = useMemo(() => {
    const listMenu: any = [];
    mockMenuList.forEach(e => {
      e.permission?.forEach((item: string) => {
        const check: any = checkPrivileges(item);
        if (check) {
          const findRole = listMenu.find((y: any) => y.code == e.code);
          const dataChild: any = [];
          const checkIsInChild = (item: any) => {
            const find = dataChild.find((e: any) => e.path == item.path);
            return find;
          };
          if (e.children) {
            e.children.forEach(y => {
              if (y.permission) {
                y.permission.forEach((itemY: string) => {
                  const check: any = checkPrivileges(itemY);
                  if (check && !checkIsInChild(y)) {
                    dataChild.push(y);
                  }
                });
              } else {
                !checkIsInChild(y) && dataChild.push(y);
              }
            });
          }
          if (!findRole) {
            if (dataChild.length > 0) {
              listMenu.push({ ...e, children: dataChild });
            } else {
              listMenu.push({ ...e });
            }
          }
        }
      });
    });
    return listMenu;
  }, [role]);

  const isRoleViewAllDashboard = useMemo(() => {
    return checkPrivileges('VIEW_ALL_DASHBOARD');
  }, [role]);

  const isRoleViewDashboardAgent = useMemo(() => {
    return checkPrivileges('VIEW_DASHBOARD_AGENT');
  }, [role]);

  const isShowInputSearch = useMemo(() => {
    const roleAccept = ['SUPER_ADMIN', 'ADMIN'];
    return roleAccept.includes(infoUser?.role);
  }, [infoUser]);

  useEffect(() => {}, [role]);
  return {
    role,
    checkPrivileges,
    isRoleViewAllDashboard,
    isRoleViewDashboardAgent,
    infoUser,
    menuForRole,
    isShowInputSearch,
  };
};

export default useCheckPrivileges;

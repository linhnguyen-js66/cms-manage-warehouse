import { mappingLabelModuleUser, rolesMappingLabel } from '@/mock/permission/role.mock';

export const comparePrivilegesSelect = (dataRole: any) => {
  const data: any = {};
  dataRole.forEach((e: any) => {
    let label = '';
    let labelGroup = '';
    rolesMappingLabel.forEach(i => {
      if (i.children[e.privilege]) {
        label = i.children[e.privilege];
        labelGroup = mappingLabelModuleUser[e.group_name] || i.name;
      }
    });
    if (data[e.group_name]) {
      const check = data[e.group_name].children.find((i: any) => i.privilege == e.privilege);
      !check && data[e.group_name].children.push({ ...e, label });
    } else {
      data[e.group_name] = {
        ...e,
        privilege: e.group_name,
        privilege_group: e.privilege,
        children: [{ ...e, label }],
        label: labelGroup,
        id: e.id + e.group_name,
      };
    }
  });
  const dataArray: any = [];
  Object.keys(data).forEach(key => {
    dataArray.push(data[key]);
  });
  return dataArray;
};

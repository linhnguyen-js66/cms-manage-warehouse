import React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

interface MenuItemProps {
  text: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

interface MenuComponentProps {
  anchorEl: null | HTMLElement;
  open: boolean;
  onClose: () => void;
  menuItems: MenuItemProps[];
}

const MenuAnchor: React.FC<MenuComponentProps> = ({ anchorEl, open, onClose, menuItems }) => {
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {menuItems.map((item, index) => (
        <MenuItem  key={index} onClick={item.onClick}>
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.text} />
        </MenuItem>
      ))}
    </Menu>
  );
};

export default MenuAnchor;

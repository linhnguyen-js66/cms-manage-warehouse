import styled from "@emotion/styled";
import {
  ListItemIcon,
  ListItemText,
  MenuItem,
  Tooltip,
  TooltipProps,
  tooltipClasses,
} from "@mui/material";
import React, { ReactNode } from "react";

type MenuItemType = {
  icon: ReactNode;
  text: string;
  onClick: () => void;
};

type BaseTooltipProps = {
  menuItems: MenuItemType[] | string;
  children?: any;
  placement?:
    | "bottom-start"
    | "top"
    | "right"
    | "bottom"
    | "left"
    | "bottom-end"
    | "left-end"
    | "left-start"
    | "right-end"
    | "right-start"
    | "top-end"
    | "top-start";
  width?: string; 
};

const BaseTooltip: React.FC<BaseTooltipProps> = ({
  menuItems,
  children,
  placement = "top",
  width 
}) => {
  const renderTooltipContent = () => {
    if (Array.isArray(menuItems)) {
      return menuItems.map((item, index) => {
        return (
          <MenuItem key={index} onClick={item.onClick}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText
              primaryTypographyProps={{ fontSize: "12px" }}
              primary={item.text}
            />
          </MenuItem>
        );
      });
    } else {
      return menuItems;
    }
  };

  return (
    <LightTooltip arrow placement={placement} title={renderTooltipContent()} width={width}>
      {children}
    </LightTooltip>
  );
};

export default BaseTooltip;

const LightTooltip = styled(({ className, width, ...props }: TooltipProps & { width?: string }) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ width }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: "#ccc",
    color: "rgba(0, 0, 0, 0.87)",
    width: width,
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: "#ccc",
    fontSize: 30,
  },
}));

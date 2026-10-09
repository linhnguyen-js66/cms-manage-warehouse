import React, { useState, useMemo, useCallback } from "react";
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {  Add } from "@mui/icons-material";
import ButtonBase from "../buttonBase";

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  action: (id: any, row: any) => void;
  condition?: (row: any) => boolean;
}

interface CustomTableProps {
  headerTable: string[];
  rows: any[];
  align?: "left" | "center" | "right" | "inherit" | "justify";
  onAdd?: () => void;
  menuItems?: MenuItemProps[];
  children?: any;
}

const CustomTable: React.FC<CustomTableProps> = ({
  headerTable,
  rows = [],
  align = "left",
  onAdd,
  menuItems = [],
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<{
    index: number | null;
    row: any | null;
  }>({ index: null, row: null });

  const open = Boolean(anchorEl);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>, index: number, row: any) => {
      setAnchorEl(event.currentTarget);
      setSelectedRow({ index, row });
    },
    []
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedRow({ index: null, row: null });
  }, []);

  const handleMenuItemClick = useCallback(
    (item: MenuItemProps) => {
      if (selectedRow.index !== null && selectedRow.row !== null) {
        item.action(rows[selectedRow.index].ID, selectedRow.row);
      }
      handleClose();
    },
    [rows, selectedRow, handleClose]
  );

  const filteredMenuItems = useMemo(
    () =>
      menuItems.filter((item) =>
        item.condition ? item.condition(selectedRow.row) : true
      ),
    [menuItems, selectedRow]
  );

  return (
    <TableContainer
      sx={{
        width: "100%",
        overflow: "auto",
        maxHeight: "calc(100vh - 360px)",
      }}
      elevation={3}
      component={Paper}
    >
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {headerTable.map((item, idx) => (
              <TableCell
                key={idx}
                sx={{
                  borderRight: "1px solid #ccc",
                  fontWeight: "bold",
                  height: 20,
                  backgroundColor: "#fafafa",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                align={align}
              >
                {item}
              </TableCell>
            ))}
            {menuItems.length > 0 && (
              <TableCell
                sx={{
                  borderRight: "1px solid #ccc",
                  fontWeight: "bold",
                  backgroundColor: "#fafafa",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "5%",
                }}
                align="center"
              >
                Thao tác
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody
          sx={{
            "& .MuiTableRow-root:hover": {
              backgroundColor: "#f0f0f0",
            },
          }}
        >
          {rows.length > 0 ? (
            rows.map((row: any, idx: number) => (
              <TableRow key={idx}>
                {headerTable.map((header, colIdx) => (
                  <TableCell
                    key={colIdx}
                    align={align}
                    sx={{
                      whiteSpace: "wrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.hasOwnProperty(header) ? row[header] : "-"}
                  </TableCell>
                ))}
                {menuItems.length > 0 && (
                  <TableCell align="center">
                      <ButtonBase onClick={(event) => handleClick(event, idx, row)}>
                        Thao tác
                      </ButtonBase>
                      {/* <IconButton onClick={(event) => handleClick(event, idx, row)}>
                        <MoreHoriz />
                      </IconButton> */}
                    <Menu
                      anchorEl={anchorEl}
                      open={open}
                      onClose={handleClose}
                      anchorOrigin={{
                        vertical: "bottom",
                        horizontal: "right",
                      }}
                      transformOrigin={{
                        vertical: "top",
                        horizontal: "right",
                      }}
                    >
                      {filteredMenuItems.length === 0 ? (
                        <MenuItem>Không có quyền</MenuItem>
                      ) : (
                        filteredMenuItems?.map((item, index) => (
                          <MenuItem
                            key={index}
                            onClick={() => handleMenuItemClick(item)}
                          >
                            <ListItemIcon>
                              {React.createElement(item.icon, {
                                fontSize: "small",
                              })}
                            </ListItemIcon>
                            <ListItemText primary={item.label} />
                          </MenuItem>
                        ))
                      )}
                    </Menu>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={headerTable.length + 1} align="center">
                <Box className="flex justify-center flex-col items-center">
                  <Typography className="text-14 flex justify-center p-12">
                    <svg
                      width="64"
                      height="41"
                      viewBox="0 0 64 41"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g
                        transform="translate(0 1)"
                        fill="none"
                        fillRule="evenodd"
                      >
                        <ellipse
                          fill="#f5f5f5"
                          cx="32"
                          cy="33"
                          rx="32"
                          ry="7"
                        ></ellipse>
                        <g fillRule="nonzero" stroke="#d9d9d9">
                          <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z"></path>
                          <path
                            d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z"
                            fill="#fafafa"
                          ></path>
                        </g>
                      </g>
                    </svg>
                  </Typography>
                  <Typography>Không có dữ liệu</Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {onAdd && (
        <Box className="flex justify-center p-4">
          <Tooltip title="Add">
            <IconButton color="primary" onClick={onAdd}>
              <Add />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </TableContainer>
  );
};

export default CustomTable;

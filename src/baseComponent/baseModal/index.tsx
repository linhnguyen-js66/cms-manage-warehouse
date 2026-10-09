import React, { FC, ReactNode } from "react";
import { Dialog, DialogTitle, IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";

interface BaseDialogProps {
  open: boolean;
  onCancel: () => void;
  children?: ReactNode;
  title?: string;
  maxWidth?: string | any;
}

const BaseDialog: FC<BaseDialogProps> = ({
  open = false,
  onCancel,
  children,
  title = "Dialog",
  maxWidth = "md",
}) => {
  return (
    <Dialog maxWidth={maxWidth} fullWidth open={open} onClose={onCancel}>
      <DialogTitle sx={{display:"flex",justifyContent:"space-between", alignItems:"center"}}>
        {title}
        <IconButton onClick={onCancel}>
          <Close />
        </IconButton>
      </DialogTitle>
      {children}
    </Dialog>
  );
};

export default BaseDialog;

import React from 'react';
import { Button, ButtonProps } from "@mui/material";

interface ButtonBaseProps extends ButtonProps {
  classNames?: string;
}

const ButtonBase: React.FC<ButtonBaseProps> = (props) => {
  const { children, size = "small", classNames, ...restProps } = props;

  return (
    <div>
      <Button 
        {...restProps}
        sx={{
          color:"#FFFFFF",
          backgroundColor:"#13c2c2",
          textTransform: 'none',
          ':hover': {
            bgcolor: '#13c2c2',
            color: '#FFFFFF',
          },
        }}
        className={`${classNames}`}
        size={size}
      >
        {children}
      </Button>
    </div>
  );
};

export default ButtonBase;

import { TextField, TextFieldProps } from "@mui/material";
import React from "react";

type InputBaseProps = TextFieldProps & {
  name?: string;
  classNames?: string;
  size?: "small";
};

const InputBase: React.FC<InputBaseProps> = (props) => {
  const { name, size = "small", classNames, children, ...restProps } = props;

  return (
    <TextField
      className={`${classNames}`}
      sx={{
        "& label.Mui-focused": {
          color: "#36cfc9",
        },
        "& .MuiInput-underline:after": {
          borderBottomColor: "#36cfc9",
        },
        "& .MuiFilledInput-underline:after": {
          borderBottomColor: "#36cfc9",
        },
        "& .MuiOutlinedInput-root": {
          "&.Mui-focused fieldset": {
            borderColor: "#36cfc9",
          },
        },
        ".css-1n4twyu-MuiInputBase-input-MuiOutlinedInput-input ": {
          padding: "4px 11px",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "#59d4d4 !important",
        },

        ".css-jedpe8-MuiSelect-select-MuiInputBase-input-MuiOutlinedInput-input":
          {
            padding: "4px 11px",
          },
          input: {
            '&::placeholder': {
              fontSize:"14px"
            },
          },
      }}
      size={size}
      {...restProps}
    >
      {children}
    </TextField>
  );
};

export default InputBase;

import React from "react";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

interface BaseDatePickerProps {
  label: string;
  name?: string;
  value?: any | null;
  onChange?: (date: any | null) => void;
  size?:any
  fullWidth?:boolean
  errorText?:any
  cssSx?:any
  disabled?:boolean
}

const BaseDatePicker: React.FC<BaseDatePickerProps> = ({
  label,
  name= "startDate",
  value,
  size="small",
  fullWidth = false,
  onChange,
  errorText,
  cssSx,
  disabled,
  ...restProps
}) => {
  const dayjsValue = value ? dayjs(value) : null;
  return (
    <DatePicker
     {...restProps}
     disabled={disabled}
      label={label}
      format="DD/MM/YYYY"
      value={dayjsValue}
      onChange={onChange}
      slotProps={{
        day: {
          sx: {
            "&.MuiPickersDay-root.Mui-selected": {
              backgroundColor: "#59d4d4",
            },
            "&:hover": {
              backgroundColor: "#59d4d4",
            },
          },
        },
        textField: ({ position }) => ({
          color: position === "start" ? "success" : "warning",
          size: size,
          fullWidth: fullWidth,
          ...errorText
        }),
        
      }}
      sx={{
        "& .MuiInputLabel-root.Mui-focused": {
          color: "#59d4d4",
          borderColor: "#59d4d4 !important",
        },
        "& .MuiOutlinedInput-root": {
          "&:hover > fieldset": { borderColor: "#59d4d4" },
          borderRadius: "6px",
        },
        "&.MuiPickersDay-root.Mui-selected": {
          backgroundColor: "#f0ca4d",
        },
       ...cssSx
      }}
      name={name}
    />
  );
};

export default BaseDatePicker;

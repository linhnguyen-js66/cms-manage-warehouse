import React from "react";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import { InputLabel } from "@mui/material";

interface Option {
  value?: any;
  label?: string;
}

interface CustomSelectProps {
  options?: Option[];
  defaultValue?: any;
  value?: any;
  onChange?: (event: SelectChangeEvent<any>) => void;
  size?: "small";
  minWidth?: number;
  label?: string;
  fullWidth?: boolean;
}


const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  size = "small",
  minWidth = 120,
  label,
  defaultValue="",
  fullWidth=false,
  ...props
}) => {
  return (
    <FormControl fullWidth={fullWidth} size={size} sx={{ minWidth: minWidth }} {...props}>
       <InputLabel  sx={{
          '&.MuiInputLabel-root.Mui-focused': {
            color: '#59d4d4', 
          },
        }} >{label}</InputLabel>
      <Select
        label={label}
        sx={{
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#59d4d4 !important",
          },
        }}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
      >
        {options?.map((option, index) => (
          <MenuItem key={index} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default CustomSelect;

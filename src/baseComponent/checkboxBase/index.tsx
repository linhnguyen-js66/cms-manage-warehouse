import React from 'react';
import { Checkbox, FormControlLabel, Typography, CheckboxProps } from '@mui/material';

interface CheckboxBaseProps {
  label: string;
  cssLabel?: string;
  checkboxProps?: CheckboxProps;
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const CheckboxBase: React.FC<CheckboxBaseProps> = (props) => {
  const { label, cssLabel, checkboxProps, checked = false, onChange, ...restProps } = props;

  return (
    <FormControlLabel
      style={{
        color: 'black',
      }}
      sx={{
        '& .MuiCheckbox-colorPrimary.Mui-checked': {
          color: '#59d4d4',
        },
      }}
      control={
        <Checkbox
          size="small"
          checked={checked}
          onChange={onChange}
          {...checkboxProps}
        />
      }
      label={
        <Typography className={cssLabel}>
          {label}
        </Typography>
      }
      {...restProps}
    />
  );
};

export default CheckboxBase;

import React, { useState } from "react";
import { Input } from "antd";

import "./index.css";

const FloatInput = (props: any) => {
  const [focus, setFocus] = useState(false);
  let { label, value, placeholder, type, required } = props;

  if (!placeholder) placeholder = label;

  const isOccupied = focus || (value && value.length !== 0);

  const labelClass = isOccupied ? "label as-label" : "label as-placeholder";

  const requiredMark = required ? <span className="text-danger">*</span> : null;

  return (
    <div
      className="float-label"
      onBlur={() => setFocus(false)}
      onFocus={() => setFocus(true)}
    >
      {props?.password ? (
        <Input.Password
          onChange={props.onChange}
          type={type}
          defaultValue={value}
          className="h-40"
        />
      ) : (
        <Input
          onChange={props.onChange}
          type={type}
          defaultValue={value}
          className="h-40"
        />
      )}

      <label className={labelClass}>
        {isOccupied ? label : placeholder} {requiredMark}
      </label>
    </div>
  );
};

export default FloatInput;

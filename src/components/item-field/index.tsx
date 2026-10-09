import { yard } from "@/assets/image";
import { ImageSvgLocal } from "@/baseComponent/ImageSvgLocal";
import dayjs from "dayjs";
import React, { memo } from "react";

export const ItemField = (props: {
  item: any;
  onClick: () => void;
  className?: string;
  style?: any;
}) => {
  const { item, onClick } = props;
  return (
    <div className={`${props?.className} relative`} onClick={onClick}>
      <div>
        <img
          src={yard}
          alt=""
          style={{
            ...props?.style,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }}
        />
      </div>
      <div className="p-16 rounded-radius-xxxl border-weight-s border-color-500 shadow-down-xs shadow-color-300 absolute -bottom-32 w-full bg-color-50">
        <div className="flex items-center justify-between">
          <div className="font-medium text-16">{item?.name || item?.field_name}</div>
          <div className="flex items-center">
            <ImageSvgLocal name="ic_clock" width={16} />
            <div className="text-color-700 ml-12">
              {dayjs(item?.open || item?.time_from, "HH:mm:ss").format("HH:mm")} -{" "}
              {dayjs(item?.close || item?.time_to,"HH:mm:ss").format("HH:mm")}
            </div>
          </div>
        </div>
        <div className="text-color-600">{item?.sport_type_name} - {item?.field_type_name}</div>
        <div className="mt-24">{item?.description}</div>
      </div>
    </div>
  );
};


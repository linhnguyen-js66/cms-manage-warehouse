import React from 'react';
import { IconSvgs } from "../../assets/svg";

interface ImageSvgLocalProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    name: keyof typeof IconSvgs;
}

export const ImageSvgLocal: React.FC<ImageSvgLocalProps> = ({ name, ...restProps }) => {
    const imagePath: string = IconSvgs[name] || '';

    return (
        <img src={imagePath} className='cursor-pointer' alt="error" {...restProps} />
    );
};

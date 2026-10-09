import { FC } from 'react';
import { Button } from 'antd';
import { ButtonProps } from 'antd/es/button';

interface MyButtonProps extends ButtonProps {}

const BaseButton: FC<MyButtonProps> = props => {
  return <Button {...props}>{props.children}</Button>;
};

const MyButton = Object.assign(Button, BaseButton);

export default MyButton;

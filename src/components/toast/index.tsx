import { notification } from 'antd';
import { createRef, forwardRef, useImperativeHandle } from 'react';

interface ToastProps {
  type?: 'success' | 'info' | 'warning' | 'error';
  title?: string;
  content: string;
}
// eslint-disable-next-line react/display-name
const Component = forwardRef((_: any, ref) => {
  const [api, contextHolder] = notification.useNotification();

  useImperativeHandle(ref, () => ({
    show: ({ type = 'success', title = 'Thông báo', content }: ToastProps) => {
      api[type]({
        message: title,
        description: content,
        duration: 5,
      });
    },
    destroy: () => {
      api.destroy();
    },
  }));

  return <>{contextHolder}</>;
});

type Toast = {
  show: (data: ToastProps) => void;
  destroy: () => void;
};
export const ToastRef = createRef<Toast>();

export const ToastView = () => <Component ref={ToastRef} />;

export const showToast = (props: ToastProps) => {
  ToastRef.current?.show(props);
};

export const hideToast = () => {
  ToastRef.current?.destroy();
};

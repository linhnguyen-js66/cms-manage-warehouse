import { Modal } from 'antd';
import type { ReactNode } from 'react';
import { createRef, forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';

import type { DialogProps, TYPE_MESSAGE } from '@/components/dialog/type';
import { stateDefault } from '@/components/dialog/type';

import { DialogAction } from './dialog-action';
import './index.less';

// eslint-disable-next-line react/display-name
const Component = forwardRef((_: any, ref) => {
  const [state, setState] = useState(stateDefault);

  useImperativeHandle(
    ref,
    () => ({
      show: (props: DialogProps) => {
        if (state?.isShow) return;
        setState({
          isShow: true,
          ...props,
        });
      },
      hide: () => {
        setState(stateDefault);
      },
    }),
    [state?.isShow],
  );

  const isDisableTouchOutSide = useMemo(() => {
    return state.disableTouchOutSide || state?.type === 'confirm';
  }, [state?.type, state.disableTouchOutSide]);

  const onPress = useCallback(
    (index: number) => {
      // @ts-ignore
      const item = state?.actions[index];
      !item?.stopHide && hideDialog();
      setTimeout(() => {
        if (item?.onPress && typeof item?.onPress === 'function') {
          item.onPress();
        }
      }, 250);
    },
    [state?.actions],
  );

  const _onPressBackground = useCallback(() => {
    if (!isDisableTouchOutSide) {
      hideDialog();
    }
  }, [isDisableTouchOutSide]);

  return (
    <Modal
      open={state?.isShow}
      centered
      closeIcon={<></>}
      footer={null}
      style={{ padding: 0 }}
      zIndex={1001}
      title={state.title}
    >
      <div onClick={_onPressBackground}>
        <div className="mt-4 text-14 font-normal text-text-primary tablet:text-center">
          {state.content || 'Content dialog: ....'}
        </div>
        {state.sub && <div className="mt-8 text-10 text-error-500 tablet:text-center">{state.sub}</div>}

        <div className="box-btn">
          {state.actions?.map((item, index) => {
            return <DialogAction key={index} {...item} index={index} onPress={() => onPress(index)} />;
          })}
        </div>
      </div>
    </Modal>
  );
});

type Alert = {
  show: (data: {
    title: ReactNode | string;
    content: ReactNode | string;
    type?: TYPE_MESSAGE;
    haveCloseBtn?: boolean;
    customHeader?: ReactNode;
    footer?: ReactNode;
  }) => void;
  hide: () => void;
};
export const DialogRef = createRef<Alert>();
export const DialogView = () => <Component ref={DialogRef} />;

export const showDialog = (props: DialogProps) => {
  DialogRef.current?.show(props);
};
export const hideDialog = () => {
  DialogRef.current?.hide();
};

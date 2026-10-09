import { memo, useCallback, useMemo } from 'react';

import type { ActionProps } from '@/components/dialog/type';
import { Button } from 'antd';

const Component = (prop: ActionProps) => {
  const { title, onPress, type, typeMessage, index, className } = prop;

  const _onPress = useCallback(() => {
    if (onPress && typeof onPress === 'function') {
      onPress(index || 0);
    }
  }, [onPress]);

  return (
    <Button name="" type={type} className={`${className || ''}`} onClick={_onPress}>
      {title}
    </Button>
  );
};

export const DialogAction = memo(Component);

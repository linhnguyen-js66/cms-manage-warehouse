import { useCallback, useEffect, useState } from 'react';

const useFormatState = (defaul: any) => {
  const [state, setState] = useState<any>();
  const formatState = useCallback(params => {
    setState((prev: any) => ({
      ...prev,
      ...params,
    }));
  }, []);
  const setDefaultState = useCallback(() => {
    setState(defaul);
  }, []);

  useEffect(() => {
    setDefaultState();
  }, [setDefaultState]);

  return { formatState, state, setState, setDefaultState };
};

export default useFormatState;

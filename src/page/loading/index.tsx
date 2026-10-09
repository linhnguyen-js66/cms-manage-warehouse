import {
  createRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import ReactDOM from "react-dom";
import "../../styles/loading.scss";
import HashLoader from "react-spinners/HashLoader";

const LoadingLayout = forwardRef((_, ref: any) => {
  const [visible, setVisible] = useState(false);

  // effect
  useImperativeHandle(
    ref,
    () => ({
      show: () => {
        setVisible(true);
        document.body.style.overflow = "hidden";
      },
      hide: () => {
        setVisible(false);
        document.body.style.overflow = "auto";
      },
    }),
    []
  );

  if (!visible) {
    return <></>;
  }

  return ReactDOM.createPortal(
    <div className="loading_custom">
     <HashLoader color="#36d7b7" loading={true} size={50} />
    </div>,
    document.body
  );
});

export const LoadingProgressRef = createRef<LoadingProgressRef>();
export const LoadingProgress = () => <LoadingLayout ref={LoadingProgressRef} />;

export const showLoading = () => {
  LoadingProgressRef.current?.show();
};

export const hideLoading = () => {
  LoadingProgressRef.current?.hide();
};
export interface LoadingProgressRef {
  show(): void;
  hide(): void;
}

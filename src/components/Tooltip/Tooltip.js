import cx from "classnames";
import { useCallback, useState, useRef } from "react";
import { IS_TOUCH } from "config/ui";

const OPEN_DELAY = 0;
const CLOSE_DELAY = 100;

export default function Tooltip(props) {
  const [visible, setVisible] = useState(false);
  const intervalCloseRef = useRef(null);
  const intervalOpenRef = useRef(null);

  const position = props.position ?? "left-bottom";
  const trigger = props.trigger ?? "hover";

  const positionClass =
    position === "left-bottom"
      ? "translate-y-2 left-0 top-full"
      : position === "right-bottom"
      ? "translate-y-2 right-0 top-full"
      : position === "right-top"
      ? "-translate-y-2 right-0 bottom-full"
      : position === "right"
      ? "left-[30px] translate-y-1/2 bottom-full"
      : position === "left-top"
      ? "-translate-y-2 left-0 bottom-full"
      : position === "center-top"
      ? "-translate-y-2 left-1/2 bottom-full -translate-x-1/2"
      : "translate-y-2 left-1/2 top-full -translate-x-1/2";

  const onMouseEnter = useCallback(() => {
    if (trigger !== "hover" || IS_TOUCH) return;

    if (intervalCloseRef.current) {
      clearInterval(intervalCloseRef.current);
      intervalCloseRef.current = null;
    }
    if (!intervalOpenRef.current) {
      intervalOpenRef.current = setTimeout(() => {
        setVisible(true);
        intervalOpenRef.current = null;
      }, OPEN_DELAY);
    }
  }, [setVisible, intervalCloseRef, intervalOpenRef, trigger]);

  const onMouseClick = useCallback(() => {
    if (trigger !== "click" && !IS_TOUCH) return;
    if (intervalCloseRef.current) {
      clearInterval(intervalCloseRef.current);
      intervalCloseRef.current = null;
    }
    if (intervalOpenRef.current) {
      clearInterval(intervalOpenRef.current);
      intervalOpenRef.current = null;
    }

    setVisible(true);
  }, [setVisible, intervalCloseRef, trigger]);

  const onMouseLeave = useCallback(() => {
    intervalCloseRef.current = setTimeout(() => {
      setVisible(false);
      intervalCloseRef.current = null;
    }, CLOSE_DELAY);
    if (intervalOpenRef.current) {
      clearInterval(intervalOpenRef.current);
      intervalOpenRef.current = null;
    }
  }, [setVisible, intervalCloseRef]);

  const className = cx("relative", props.className);

  return (
    <span className={className} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onMouseClick}>
      <span
        className={cx(
          {
            "relative inline-flex cursor-help": !props.disableHandleStyle,
          },
          [props.handleClassName],
          { active: visible }
        )}
      >
        {props.handle}
      </span>
      {visible && (
        <div
          className={cx([
            "absolute z-50 min-w-[250px] rounded bg-slate-700 p-[10.5px] text-left text-[14px] leading-[16px]",
            positionClass,
          ])}
        >
          {props.renderContent()}
        </div>
      )}
    </span>
  );
}

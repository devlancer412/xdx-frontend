import React, { useRef, useEffect } from "react";
import cx from "classnames";
import { motion, AnimatePresence } from "framer-motion";

import { MdClose } from "react-icons/md";

import useLockBodyScroll from "lib/useLockBodyScroll";

export default function Modal(props) {
  const {
    isVisible,
    setIsVisible,
    className,
    zIndex,
    onAfterOpen,
    disableBodyScrollLock,
    allowContentTouchMove,
    position = "center",
    overflow = "overflow-y-auto",
  } = props;

  const modalRef = useRef(null);

  useLockBodyScroll(modalRef, isVisible, {
    disableLock: disableBodyScrollLock,
    allowTouchMove: allowContentTouchMove,
  });

  useEffect(() => {
    function close(e) {
      if (e.keyCode === 27) {
        setIsVisible(false);
      }
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [setIsVisible]);

  useEffect(() => {
    if (typeof onAfterOpen === "function") onAfterOpen();
  }, [onAfterOpen]);

  const fadeVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cx(
            "fixed top-0 right-0 bottom-0 left-0 z-[900] flex text-left",
            position === "left"
              ? "items-end justify-start"
              : position === "right"
              ? "items-start justify-end"
              : " items-center justify-center"
          )}
          style={{ zIndex }}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={fadeVariants}
          transition={{ duration: 0.2 }}
        >
          <div
            className="top-0 bottom-0 right-0 left-0 z-10 bg-[#000000D4]"
            style={{
              overflow: isVisible ? "hidden" : "visible",
              position: "fixed",
            }}
            onClick={() => setIsVisible(false)}
          ></div>
          <div
            className={cx(
              "absolute z-20 m-0 max-h-screen w-80 max-w-full overflow-visible rounded bg-slate-900",
              { "top-0 bottom-0": position !== "center" },
              className
            )}
          >
            <div className="m-[15px] flex items-center justify-between">
              <div className="text-left text-[15px] leading-none">{props.label}</div>
              <div className="flex h-[23px] w-5 items-center justify-center" onClick={() => setIsVisible(false)}>
                <MdClose fontSize={20} className="inline-block cursor-pointer opacity-60" />
              </div>
            </div>
            <div className="mb-[8px] border-b border-slate-800" />
            <div
              className={cx(
                "m-[15px] max-h-[calc(100vh-77.5px)] overflow-x-hidden text-[15px] leading-[20px]",
                // position === "right" ? "pr-5" : position === "left" ? "pl-5" : "",
                overflow
              )}
              ref={modalRef}
            >
              {props.children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

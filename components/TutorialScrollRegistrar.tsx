import React, { useEffect } from "react";
import { useTutorialContext } from "../src/context/TutorialContext";

type TutorialScrollRegistrarProps = {
  scrollRef: React.RefObject<any>;
  children: React.ReactElement;
};

export default function TutorialScrollRegistrar({
  scrollRef,
  children,
}: TutorialScrollRegistrarProps) {
  const { registerScrollable, unregisterScrollable, setScrollOffset } =
    useTutorialContext();

  useEffect(() => {
    registerScrollable(scrollRef.current);
    return () => unregisterScrollable();
  }, [scrollRef, registerScrollable, unregisterScrollable]);

  return React.cloneElement(children as React.ReactElement<any>, {
    onScroll: (e: any) => setScrollOffset(e.nativeEvent.contentOffset.y),
    scrollEventThrottle: 16,
  });
}

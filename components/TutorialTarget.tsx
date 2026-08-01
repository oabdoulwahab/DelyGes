import React, { useCallback, useEffect, useRef } from "react";
import { LayoutRectangle, TouchableOpacity, View } from "react-native";
import { useTutorialContext } from "../src/context/TutorialContext";

type TutorialTargetProps = {
  id: string;
  children: React.ReactNode;
  autoAdvance?: boolean;
  scrollable?: boolean;
};

export default function TutorialTarget({
  id,
  children,
  autoAdvance = false,
  scrollable = false,
}: TutorialTargetProps) {
  const {
    registerTarget,
    unregisterTarget,
    onTargetInteract,
    measureVersion,
    registerScrollable,
    unregisterScrollable,
    setScrollOffset,
  } = useTutorialContext();
  const nodeRef = useRef<View | null>(null);

  const measureTarget = useCallback(() => {
    const node = nodeRef.current;
    if (!node || typeof (node as any).measureInWindow !== "function") return;
    (node as any).measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        registerTarget(id, { x, y, width, height });
      },
    );
  }, [id, registerTarget]);

  useEffect(() => {
    measureTarget();
    if (scrollable) {
      registerScrollable(nodeRef.current);
    }
    return () => {
      unregisterTarget(id);
      if (scrollable) {
        unregisterScrollable();
      }
    };
  }, [
    id,
    unregisterTarget,
    measureTarget,
    measureVersion,
    scrollable,
    registerScrollable,
    unregisterScrollable,
  ]);

  const handleScroll = useCallback(
    (e: any) => {
      setScrollOffset(e.nativeEvent.contentOffset.y);
    },
    [setScrollOffset],
  );

  const handlePress = useCallback(() => {
    if (autoAdvance && onTargetInteract) {
      onTargetInteract();
    }
  }, [autoAdvance, onTargetInteract]);

  if (autoAdvance) {
    return (
      <TouchableOpacity
        ref={nodeRef as any}
        onLayout={measureTarget}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  if (React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{
        ref?: React.Ref<View>;
        onLayout?: (e: any) => void;
        onScroll?: (e: any) => void;
        scrollEventThrottle?: number;
      }>,
      {
        ref: nodeRef as React.Ref<View>,
        onLayout: measureTarget,
        ...(scrollable
          ? { onScroll: handleScroll, scrollEventThrottle: 16 }
          : {}),
      },
    );
  }

  return <>{children}</>;
}

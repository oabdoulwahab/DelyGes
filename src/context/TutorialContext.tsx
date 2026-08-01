import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { LayoutRectangle } from "react-native";

export type TargetLayout = LayoutRectangle & { id: string };

export type TutorialContextType = {
  registerTarget: (id: string, layout: LayoutRectangle) => void;
  unregisterTarget: (id: string) => void;
  getTargetLayout: (id: string) => TargetLayout | undefined;
  targetLayouts: Record<string, TargetLayout>;
  onTargetInteract: (() => void) | null;
  setOnTargetInteract: (callback: (() => void) | null) => void;
  requestRemeasure: () => void;
  measureVersion: number;
  registerScrollable: (ref: any) => void;
  unregisterScrollable: () => void;
  setScrollOffset: (offset: number) => void;
  scrollToTarget: (targetId: string, padding: number) => void;
};

const TutorialContext = createContext<TutorialContextType>({
  registerTarget: () => {},
  unregisterTarget: () => {},
  getTargetLayout: () => undefined,
  targetLayouts: {},
  onTargetInteract: null,
  setOnTargetInteract: () => {},
  requestRemeasure: () => {},
  measureVersion: 0,
  registerScrollable: () => {},
  unregisterScrollable: () => {},
  setScrollOffset: () => {},
  scrollToTarget: () => {},
});

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [targetLayouts, setTargetLayouts] = useState<Record<string, TargetLayout>>({});
  const [measureVersion, setMeasureVersion] = useState(0);
  const targetLayoutsRef = useRef<Record<string, TargetLayout>>({});
  const onTargetInteractRef = useRef<(() => void) | null>(null);
  const scrollableRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);

  const registerTarget = useCallback((id: string, layout: LayoutRectangle) => {
    targetLayoutsRef.current[id] = { ...layout, id };
    setTargetLayouts({ ...targetLayoutsRef.current });
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    delete targetLayoutsRef.current[id];
    setTargetLayouts({ ...targetLayoutsRef.current });
  }, []);

  const getTargetLayout = useCallback((id: string) => {
    return targetLayoutsRef.current[id];
  }, []);

  const requestRemeasure = useCallback(() => {
    setMeasureVersion((v) => v + 1);
  }, []);

  const setOnTargetInteract = useCallback((callback: (() => void) | null) => {
    onTargetInteractRef.current = callback;
  }, []);

  const onTargetInteract = useCallback(() => {
    onTargetInteractRef.current?.();
  }, []);

  const registerScrollable = useCallback((ref: any) => {
    scrollableRef.current = ref;
  }, []);

  const unregisterScrollable = useCallback(() => {
    scrollableRef.current = null;
  }, []);

  const setScrollOffset = useCallback((offset: number) => {
    scrollOffsetRef.current = offset;
  }, []);

  const scrollToTarget = useCallback((targetId: string, padding: number) => {
    const scrollRef = scrollableRef.current;
    const layout = targetLayoutsRef.current[targetId];
    if (!scrollRef || !layout) return;

    const currentOffset = scrollOffsetRef.current;

    // windowY = scrollableTopY + (contentY - offset)
    // On veut que la cible soit à "desiredScreenY" de l'écran :
    // offset' = targetWindowY + currentOffset - desiredScreenY
    // (la position du scrollable s'annule, pas besoin de la mesurer)
    const desiredScreenY = 120 + padding;
    const targetY = Math.max(0, layout.y + currentOffset - desiredScreenY);

    if (typeof scrollRef.scrollToPosition === "function") {
      scrollRef.scrollToPosition(0, targetY, true);
    } else if (typeof scrollRef.scrollTo === "function") {
      scrollRef.scrollTo({ y: targetY, animated: true });
    } else if (typeof scrollRef.scrollToOffset === "function") {
      scrollRef.scrollToOffset({ offset: targetY, animated: true });
    }
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        registerTarget,
        unregisterTarget,
        getTargetLayout,
        targetLayouts,
        onTargetInteract,
        setOnTargetInteract,
        requestRemeasure,
        measureVersion,
        registerScrollable,
        unregisterScrollable,
        setScrollOffset,
        scrollToTarget,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  return useContext(TutorialContext);
}

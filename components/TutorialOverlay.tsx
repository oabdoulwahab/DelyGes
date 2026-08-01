import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  Svg,
  Mask,
  Rect as SvgRect,
  Defs,
} from "react-native-svg";
import { useTutorialContext } from "../src/context/TutorialContext";
import { Tutorial } from "../src/constants/tutorials";
import { COLORS } from "../styles/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STATUS_BAR_HEIGHT = Platform.OS === "ios" ? 47 : 24;

type TutorialOverlayProps = {
  visible: boolean;
  tutorial: Tutorial | null;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
};

export default function TutorialOverlay({
  visible,
  tutorial,
  currentStep,
  onNext,
  onPrev,
  onClose,
}: TutorialOverlayProps) {
  const { targetLayouts, requestRemeasure, scrollToTarget } = useTutorialContext();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [popoverHeight, setPopoverHeight] = useState(220);
  const [controlsHeight, setControlsHeight] = useState(150);

  const step = tutorial?.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = tutorial
    ? currentStep === tutorial.steps.length - 1
    : false;
  const hasTarget = step?.targetId ? true : false;
  const targetLayout = step?.targetId
    ? targetLayouts[step.targetId]
    : undefined;
  const highlightPadding = step?.highlightPadding ?? 12;

  const isTargetOffscreen =
    hasTarget &&
    !!targetLayout &&
    (targetLayout.y < 0 ||
      targetLayout.y + targetLayout.height > SCREEN_HEIGHT - 80);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // Re-mesurer les cibles après l'apparition de l'overlay
      const timer = setTimeout(() => {
        requestRemeasure();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, requestRemeasure]);

  useEffect(() => {
    if (!hasTarget || !step?.targetId) return;

    const layout = targetLayout;
    if (!layout) return;

    const targetVisible =
      layout.y >= 0 && layout.y + layout.height <= SCREEN_HEIGHT - 80;

    if (!targetVisible) {
      // La cible est hors écran : défiler le contenu pour la ramener à l'écran
      scrollToTarget(step.targetId, highlightPadding);
      const timer = setTimeout(() => {
        requestRemeasure();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [currentStep, hasTarget, step?.targetId, highlightPadding, scrollToTarget, requestRemeasure, targetLayout]);

  useEffect(() => {
    if (!targetLayout || !hasTarget) {
      setPopoverPosition(null);
      return;
    }

    const targetBottom = targetLayout.y + targetLayout.height;
    const popoverWidth = Math.min(SCREEN_WIDTH - 40, 360);

    // Zone sûre : en bas on réserve l'espace des contrôles (bottom: 40)
    const bottomPadding = 40;
    const controlsTop = SCREEN_HEIGHT - bottomPadding - controlsHeight;
    const safeTop = 10;

    // Placement AU-DESSUS : le bas du popover reste juste au-dessus de la cible
    const aboveBottom = targetLayout.y - 20;
    const aboveTop = aboveBottom - popoverHeight;
    const fitsAbove =
      aboveTop >= safeTop && aboveBottom <= controlsTop;

    // Placement EN DESSOUS : le haut du popover juste sous la cible
    const belowTop = targetBottom + 20;
    const fitsBelow =
      belowTop >= safeTop && belowTop + popoverHeight <= controlsTop;

    const spaceAbove = targetLayout.y;
    const spaceBelow = SCREEN_HEIGHT - targetBottom;

    let top: number;
    if (fitsAbove && (!fitsBelow || spaceAbove >= spaceBelow)) {
      top = aboveTop;
    } else if (fitsBelow) {
      top = belowTop;
    } else {
      // Ni au-dessus ni en dessous : centrer dans la zone sûre
      const maxTop = controlsTop - popoverHeight;
      const centerTop = (safeTop + controlsTop - popoverHeight) / 2;
      top = Math.max(safeTop, Math.min(centerTop, maxTop));
    }

    const left = Math.max(
      10,
      Math.min(
        targetLayout.x + targetLayout.width / 2 - popoverWidth / 2,
        SCREEN_WIDTH - popoverWidth - 10,
      ),
    );

    setPopoverPosition({ top, left, width: popoverWidth });
  }, [targetLayout, hasTarget, currentStep, popoverHeight, controlsHeight]);

  if (!visible || !tutorial || !step) return null;

  const renderSpotlight = () => {
    if (!hasTarget || !targetLayout) return null;
    if (isTargetOffscreen) return null;

    const x = targetLayout.x - highlightPadding;
    const y = targetLayout.y - highlightPadding;
    const w = targetLayout.width + highlightPadding * 2;
    const h = targetLayout.height + highlightPadding * 2;
    const radius = 16;

    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
      >
        <Defs>
          <Mask
            id="spotlight"
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          >
            <SvgRect
              x={0}
              y={0}
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              fill="white"
            />
            <SvgRect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={radius}
              ry={radius}
              fill="black"
            />
          </Mask>
        </Defs>
        <SvgRect
          x={0}
          y={0}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          fill="rgba(0,0,0,0.65)"
          mask="url(#spotlight)"
        />
      </Svg>
    );
  };

  const renderPopover = () => {
    if (!hasTarget || isTargetOffscreen) {
      return (
        <Animated.View style={[styles.centeredPopover, { opacity: fadeAnim }]}>
          <Text style={styles.popoverTitle}>{step.title}</Text>
          <Text style={styles.popoverDescription}>{step.description}</Text>
        </Animated.View>
      );
    }

    if (!popoverPosition) return null;

    const arrowTop =
      targetLayout && hasTarget
        ? targetLayout.y + targetLayout.height + highlightPadding
        : popoverPosition.top + popoverPosition.width;

    const showArrowBelow =
      targetLayout && hasTarget
        ? arrowTop < popoverPosition.top
        : true;

    return (
      <Animated.View
        style={[
          styles.popover,
          {
            top: popoverPosition.top,
            left: popoverPosition.left,
            width: popoverPosition.width,
            opacity: fadeAnim,
          },
        ]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - popoverHeight) > 2) {
            setPopoverHeight(h);
          }
        }}
      >
        {showArrowBelow && (
          <View
            style={[
              styles.arrow,
              { top: -8, left: popoverPosition.width / 2 - 6 },
            ]}
          />
        )}
        {!showArrowBelow && targetLayout && hasTarget && (
          <View
            style={[
              styles.arrow,
              { bottom: -8, top: "auto", transform: [{ rotate: "180deg" }] },
            ]}
          />
        )}
        <View style={styles.popoverHeader}>
          <MaterialIcons name={step.icon as any} size={24} color={COLORS.primary} />
          <Text style={styles.popoverTitle}>{step.title}</Text>
        </View>
        <Text style={styles.popoverDescription}>{step.description}</Text>
      </Animated.View>
    );
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={StyleSheet.absoluteFill} />
      </TouchableOpacity>

      {renderSpotlight()}

      {renderPopover()}

      <View
        style={styles.controls}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - controlsHeight) > 2) {
            setControlsHeight(h);
          }
        }}
      >
        <View style={styles.dotsContainer}>
          {tutorial.steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentStep && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.buttonsContainer}>
          {!isFirstStep && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onPrev}
            >
              <MaterialIcons name="chevron-left" size={20} color={COLORS.muted} />
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                Précédent
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={onNext}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {isLastStep ? "Commencer" : "Suivant"}
            </Text>
            {!isLastStep && (
              <MaterialIcons name="chevron-right" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={onClose}>
          <Text style={styles.skipText}>
            {isLastStep ? "Fermer" : "Passer le tutoriel"}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    zIndex: 9999,
  },
  centeredPopover: {
    position: "absolute",
    top: "30%",
    left: 10,
    right: 10,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  popover: {
    position: "absolute",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 100,
  },
  popoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  popoverTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    flexShrink: 1,
  },
  popoverDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  arrow: {
    position: "absolute",
    left: 0,
    right: 0,
    marginHorizontal: "auto",
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: COLORS.card,
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderLight,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    maxWidth: 400,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 4,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.borderLight,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextPrimary: {
    color: "#FFFFFF",
  },
  buttonTextSecondary: {
    color: COLORS.muted,
  },
  skipButton: {
    marginTop: 12,
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.muted,
    textDecorationLine: "underline",
  },
});
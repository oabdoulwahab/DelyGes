import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TUTORIALS, TUTORIAL_STORAGE_KEY, Tutorial } from "../constants/tutorials";
import { useTutorialContext } from "../context/TutorialContext";

export function useTutorial(screenId: string) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const { setOnTargetInteract } = useTutorialContext();

  useEffect(() => {
    const loadTutorialState = async () => {
      try {
        const tutorialData = TUTORIALS.find((t) => t.id === screenId);
        if (!tutorialData) return;

        const stored = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
        const seenTutorials: string[] = stored ? JSON.parse(stored) : [];

        if (!seenTutorials.includes(screenId)) {
          setTutorial(tutorialData);
          setCurrentStep(0);
          setIsVisible(true);
        }
      } catch (error) {
        console.error("Erreur chargement tutoriel:", error);
      }
    };

    loadTutorialState();
  }, [screenId]);

  const markAsSeen = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
      const seenTutorials: string[] = stored ? JSON.parse(stored) : [];

      if (!seenTutorials.includes(screenId)) {
        seenTutorials.push(screenId);
        await AsyncStorage.setItem(
          TUTORIAL_STORAGE_KEY,
          JSON.stringify(seenTutorials),
        );
      }
    } catch (error) {
      console.error("Erreur sauvegarde tutoriel:", error);
    }
  }, [screenId]);

  const nextStep = useCallback(() => {
    if (!tutorial) return;

    if (currentStep < tutorial.steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsVisible(false);
      markAsSeen();
    }
  }, [currentStep, tutorial, markAsSeen]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const closeTutorial = useCallback(() => {
    setIsVisible(false);
    markAsSeen();
  }, [markAsSeen]);

  const showTutorial = useCallback(() => {
    const tutorialData = TUTORIALS.find((t) => t.id === screenId);
    if (tutorialData) {
      setTutorial(tutorialData);
      setCurrentStep(0);
      setIsVisible(true);
    }
  }, [screenId]);

  useEffect(() => {
    if (!tutorial || !isVisible) {
      setOnTargetInteract(null);
      return;
    }

    const step = tutorial.steps[currentStep];
    if (step?.autoAdvance && step?.targetId) {
      setOnTargetInteract(nextStep);
    } else {
      setOnTargetInteract(null);
    }

    return () => {
      setOnTargetInteract(null);
    };
  }, [tutorial, isVisible, currentStep, nextStep, setOnTargetInteract]);

  return {
    isVisible,
    currentStep,
    tutorial,
    nextStep,
    prevStep,
    closeTutorial,
    showTutorial,
  };
}
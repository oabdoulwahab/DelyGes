import { COLORS } from "./colors";

export const TEXT = {
  title: {
    fontSize: 18,
    fontWeight: "bold" as const,
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },
  label: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: COLORS.muted,
    textTransform: "uppercase" as const,
  },
};

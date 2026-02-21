import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const notificationsStyles = StyleSheet.create({
  // Header
  header: {
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  // Banner
  unreadBanner: {
    backgroundColor: COLORS.primarySoft,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
  },
  unreadBannerText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  // Liste
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  // Item de notification
  notificationItem: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  notificationUnread: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary + "30",
  },
  notificationIcon: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.xs,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginRight: SPACING.sm,
  },
  notificationTitleUnread: {
    color: COLORS.primary,
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.muted,
  },
  notificationBody: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.card,
  },

  // Action de suppression
  deleteAction: {
    backgroundColor: COLORS.danger,
    width: 70,
    borderRadius: 16,
    marginLeft: SPACING.xs,
    marginBottom: SPACING.sm,
    justifyContent: "center",
    alignItems: "center",
  },

  // État vide
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: SPACING.xl,
  },
});
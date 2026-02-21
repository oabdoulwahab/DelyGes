import { StyleSheet } from "react-native";
import { COLORS } from "./colors";
import { SPACING } from "./spacing";

export const settingsStyles = StyleSheet.create({
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 48,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderVeryLight,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  saveButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // Content
  content: {
    flex: 1,
    marginTop: 104, // Hauteur du header (48 + padding)
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  profileImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.primarySoft,
    overflow: 'hidden',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  profileSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },

  // Section
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },

  // Card items
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderVeryLight,
  },
  cardItemNoBorder: {
    borderBottomWidth: 0,
  },
  cardItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  cardItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  cardItemLabelDanger: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.danger,
  },
  cardItemInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 16,
    color: COLORS.white,
    padding: 0,
  },
  cardItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardItemValue: {
    fontSize: 16,
    color: COLORS.white,
  },

  // Goal input
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalInput: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  currency: {
    fontSize: 16,
    color: COLORS.muted,
    marginLeft: SPACING.xs,
  },

  // Notification
  notificationContent: {
    flexDirection: 'column',
    gap: 2,
  },
  notificationSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
  },

  // Danger item
  cardItemDanger: {
    backgroundColor: COLORS.dangerSoft,
  },

  // Logout button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 28,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.danger,
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.muted,
    marginTop: SPACING.lg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.muted,
  },

  // Auth error
  authErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  authErrorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginTop: SPACING.md,
  },
  authErrorButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  authErrorButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  userIdText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: SPACING.xs,
    opacity: 0.7,
  },
});
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useState, useCallback, useMemo } from "react";
import { router, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { commonStyles } from "../styles/common";
import { statsStyles } from "../styles/statsStyles";
import { COLORS } from "../styles/colors";
import { useAuth } from "../src/context/AuthContext";
import { useModal } from "../providers/ModalProvider";
import { NotificationStore } from "../src/services/notification.store";
import {
  PeriodReportService,
  PeriodReport,
  ReportGranularity,
} from "../src/services/period-report.service";
import { Formatters } from "../src/utils/formatters";

const TABS: { key: ReportGranularity; label: string }[] = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
];

const capitalize = (s: string) =>
  s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export default function Stats() {
  const { user } = useAuth();
  const { showSuccess, showError } = useModal();
  const [granularity, setGranularity] = useState<ReportGranularity>("month");
  const [refDate, setRefDate] = useState(() => new Date());
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [userName, setUserName] = useState("Livreur");

  // Clôture mensuelle
  const [showSheet, setShowSheet] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    NetInfo.fetch().then((s) => setIsConnected(s.isConnected ?? true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user?.name]);

  const firstName = useMemo(
    () => (userName || "Livreur").split(" ")[0],
    [userName],
  );
  const userInitial = useMemo(() => {
    const n = userName || "?";
    return n.trim().charAt(0).toUpperCase() || "?";
  }, [userName]);

  const loadReport = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await PeriodReportService.getReport(
        user.id,
        granularity,
        refDate,
      );
      setReport(data);
    } catch (e) {
      console.error("❌ Erreur chargement bilan:", e);
    } finally {
      setLoading(false);
    }
  }, [user, granularity, refDate]);

  const loadUnread = useCallback(async () => {
    try {
      if (!user) return;
      setUnreadCount(await NotificationStore.countUnread(user.id));
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    loadReport();
    loadUnread();
  }, [loadReport, loadUnread]);

  useFocusEffect(
    useCallback(() => {
      loadReport();
      loadUnread();
    }, [loadReport, loadUnread]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReport();
      await loadUnread();
    } finally {
      setRefreshing(false);
    }
  }, [loadReport, loadUnread]);

  // Libellé de période (pilule)
  const periodLabel = useMemo(() => {
    try {
      if (granularity === "month")
        return capitalize(Formatters.formatDate(refDate, "MMMM yyyy"));
      if (granularity === "year") return refDate.getFullYear().toString();
      const { start, end } = PeriodReportService.rangeOf("week", refDate);
      const endIncl = new Date(end);
      endIncl.setDate(endIncl.getDate() - 1);
      return `${Formatters.formatDate(start, "d")} – ${Formatters.formatDate(endIncl, "d MMM yyyy")}`;
    } catch {
      return "";
    }
  }, [granularity, refDate]);

  const prevLabel = useMemo(() => {
    try {
      if (granularity === "month")
        return capitalize(
          Formatters.formatDate(
            new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1),
            "MMM",
          ),
        );
      if (granularity === "year")
        return `${refDate.getFullYear() - 1}`;
      return "sem. préc.";
    } catch {
      return "";
    }
  }, [granularity, refDate]);

  const shiftPeriod = useCallback(
    (dir: 1 | -1) => {
      setRefDate((prev) => {
        const d = new Date(prev);
        if (granularity === "week") d.setDate(d.getDate() + dir * 7);
        else if (granularity === "year") d.setFullYear(d.getFullYear() + dir);
        else d.setMonth(d.getMonth() + dir);
        return d;
      });
    },
    [granularity],
  );

  const bucketCountLabel = useMemo(() => {
    if (!report) return "";
    if (granularity === "week") return "7 Jours";
    if (granularity === "year") return "12 Mois";
    return `${report.buckets.length} Semaines`;
  }, [granularity, report]);

  // Clôture mensuelle
  const handleCloseMonth = useCallback(async () => {
    if (!user || !report || report.granularity !== "month") return;
    setIsClosing(true);
    try {
      const { closureId, marked } = await PeriodReportService.closeMonth(
        user.id,
        report.refYear,
        report.refMonth,
      );
      console.log(`🔒 Mois clôturé #${closureId}, ${marked} reversements figés`);
      setShowSheet(false);
      showSuccess(
        "Mois clôturé !",
        `Ton bénéfice de ${Formatters.formatNumber(Math.round(report.profit))} FCFA est scellé. Certificat n°${closureId} généré.`,
      );
      await loadReport();
    } catch (e: unknown) {
      console.error("❌ Erreur clôture:", e);
      if (e instanceof Error && e.message === "MONTH_ALREADY_CLOSED") {
        showError("Déjà clôturé", "Ce mois a déjà été scellé.");
        setShowSheet(false);
        await loadReport();
      } else {
        showError("Erreur", "Impossible de clôturer ce mois. Réessaie.");
      }
    } finally {
      setIsClosing(false);
    }
  }, [user, report, loadReport, showSuccess, showError]);

  const handleShare = useCallback(async () => {
    if (!report) return;
    setIsSharing(true);
    try {
      await PeriodReportService.shareReport(report, periodLabel);
    } catch {
      /* partage annulé : silencieux */
    } finally {
      setIsSharing(false);
    }
  }, [report, periodLabel]);

  const maxBucket = useMemo(
    () => Math.max(1, ...(report?.buckets.map((b) => b.value) || [1])),
    [report],
  );

  const isClosed = report?.closure?.closed === true;
  const pendingAudit = report?.audit.pending || 0;
  const readyToClose =
    report?.granularity === "month" &&
    !isClosed &&
    (report?.count || 0) > 0 &&
    pendingAudit <= 0;

  return (
    <View style={[commonStyles.container, { backgroundColor: "#F8F9FC" }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* En-tête */}
      <View style={statsStyles.header}>
        <View style={statsStyles.headerContent}>
          <View style={statsStyles.brandRow}>
            <Text style={statsStyles.brandName}>Delygest</Text>
            <View style={statsStyles.versionPill}>
              <Text style={statsStyles.versionText}>v1.0.3</Text>
            </View>
          </View>
          <View style={statsStyles.headerActions}>
            <View style={statsStyles.syncPill}>
              <View
                style={[
                  statsStyles.syncDot,
                  { backgroundColor: isConnected ? COLORS.primary : "#D97706" },
                ]}
              />
              <Text style={statsStyles.syncText}>
                {isConnected ? "Sync" : "Off"}
              </Text>
            </View>
            <TouchableOpacity
              style={statsStyles.notificationButton}
              onPress={() => router.push("/notifications")}
              accessibilityLabel="Notifications"
            >
              <MaterialIcons name="notifications" size={22} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={statsStyles.notifBadge}>
                  <Text style={statsStyles.notifBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={statsStyles.avatar}
              onPress={() => router.push("/settings")}
              accessibilityLabel="Profil"
            >
              <Text style={statsStyles.avatarText}>{userInitial}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={statsStyles.scrollView}
        contentContainerStyle={statsStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Bannière félicitation */}
        <View style={statsStyles.congratsBanner}>
          <View style={statsStyles.congratsLeft}>
            <MaterialIcons name="two-wheeler" size={20} color={COLORS.primary} />
            <Text style={statsStyles.congratsText} numberOfLines={2}>
              Excellent travail ce mois-ci,{" "}
              <Text style={statsStyles.congratsName}>{firstName}</Text> !
            </Text>
          </View>
          <View style={statsStyles.proPill}>
            <MaterialIcons name="verified" size={14} color={COLORS.primary} />
            <Text style={statsStyles.proPillText}>Abidjan Pro</Text>
          </View>
        </View>

        {/* Titre + période */}
        <View style={statsStyles.titleBlock}>
          <View style={statsStyles.titleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={statsStyles.overline}>Bilan d&apos;activité</Text>
              <Text style={statsStyles.pageTitle}>Statistiques & Clôture</Text>
            </View>
            <View style={statsStyles.monthNav}>
              <TouchableOpacity
                style={statsStyles.monthNavButton}
                onPress={() => shiftPeriod(-1)}
                accessibilityLabel="Période précédente"
              >
                <MaterialIcons name="chevron-left" size={22} color={COLORS.muted} />
              </TouchableOpacity>
              <View style={statsStyles.monthPill}>
                <MaterialIcons name="calendar-month" size={15} color={COLORS.primary} />
                <Text style={statsStyles.monthPillText}>{periodLabel}</Text>
              </View>
              <TouchableOpacity
                style={statsStyles.monthNavButton}
                onPress={() => shiftPeriod(1)}
                accessibilityLabel="Période suivante"
              >
                <MaterialIcons name="chevron-right" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={statsStyles.periodTabs}>
            {TABS.map((t) => {
              const active = granularity === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    statsStyles.periodTab,
                    active && statsStyles.periodTabActive,
                  ]}
                  onPress={() => setGranularity(t.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      statsStyles.periodTabText,
                      active && statsStyles.periodTabTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                  {active && <View style={statsStyles.periodTabDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading || !report ? (
          <View style={statsStyles.emptyCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={statsStyles.emptyText}>Chargement du bilan…</Text>
          </View>
        ) : (
          <>
            {/* Hero bénéfice net */}
            <View style={statsStyles.card}>
              <View style={statsStyles.heroTopRow}>
                <View
                  style={[
                    statsStyles.growthBadge,
                    report.changePct < 0 && statsStyles.growthBadgeDown,
                  ]}
                >
                  <MaterialIcons
                    name={report.changePct < 0 ? "trending-down" : "trending-up"}
                    size={14}
                    color={report.changePct < 0 ? COLORS.danger : COLORS.successText}
                  />
                  <Text
                    style={[
                      statsStyles.growthText,
                      report.changePct < 0 && statsStyles.growthTextDown,
                    ]}
                  >
                    {report.changePct >= 0 ? "+" : ""}
                    {report.changePct}% vs {prevLabel}
                  </Text>
                </View>
              </View>
              <View>
                <Text style={statsStyles.heroLabel}>Bénéfice net récolté</Text>
                <View style={statsStyles.heroAmountRow}>
                  <Text style={statsStyles.heroAmount}>
                    {Formatters.formatNumber(Math.round(report.profit))}
                  </Text>
                  <Text style={statsStyles.heroCurrency}>FCFA</Text>
                </View>
              </View>

              {report.goal > 0 ? (
                <View style={statsStyles.goalBox}>
                  <View style={statsStyles.goalRow}>
                    <Text style={statsStyles.goalTitle}>
                      <MaterialIcons name="flag" size={16} color={COLORS.primary} />{" "}
                      Objectif {Formatters.formatNumber(report.goal)} FCFA
                    </Text>
                    <Text style={statsStyles.goalPct}>
                      {report.goalProgress.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={statsStyles.goalTrack}>
                    <View
                      style={[
                        statsStyles.goalFill,
                        { width: `${report.goalProgress}%` },
                      ]}
                    />
                  </View>
                  <View style={statsStyles.goalHint}>
                    <MaterialIcons name="electric-bolt" size={17} color="#B45309" />
                    <Text style={statsStyles.goalHintText}>
                      {report.goalProgress >= 100 ? (
                        <>Palier décroché, champion ! 🎉</>
                      ) : (
                        <>
                          Plus que{" "}
                          <Text style={statsStyles.goalHintStrong}>
                            {Formatters.formatNumber(Math.round(report.goalRemaining))}{" "}
                            FCFA
                          </Text>{" "}
                          pour décrocher ton palier d&apos;Abidjan !
                        </>
                      )}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={statsStyles.metricGrid}>
                <View style={statsStyles.metricCell}>
                  <View style={statsStyles.metricHead}>
                    <MaterialIcons name="local-shipping" size={15} color={COLORS.primary} />
                    <Text style={statsStyles.metricLabel}>Courses</Text>
                  </View>
                  <Text style={statsStyles.metricValue}>{report.count}</Text>
                  <Text style={statsStyles.metricSub}>
                    {report.successRate}% succès
                  </Text>
                </View>
                <View style={statsStyles.metricCell}>
                  <View style={statsStyles.metricHead}>
                    <MaterialIcons name="attach-money" size={15} color={COLORS.primary} />
                    <Text style={statsStyles.metricLabel}>Moy / course</Text>
                  </View>
                  <Text style={statsStyles.metricValue}>
                    {Formatters.formatNumber(Math.round(report.avg))}{" "}
                    <Text style={statsStyles.metricUnit}>F</Text>
                  </Text>
                  <Text style={[statsStyles.metricSub, statsStyles.metricSubMuted]}>
                    Net livreur
                  </Text>
                </View>
                <View style={statsStyles.metricCell}>
                  <View style={statsStyles.metricHead}>
                    <MaterialIcons name="route" size={15} color={COLORS.infoText} />
                    <Text style={statsStyles.metricLabel}>Distance</Text>
                  </View>
                  <Text style={statsStyles.metricValue}>
                    {report.avgKmPerDay.toFixed(1).replace(".", ",")}{" "}
                    <Text style={statsStyles.metricUnit}>km</Text>
                  </Text>
                  <Text style={[statsStyles.metricSub, statsStyles.metricSubMuted]}>
                    Moyenne / jour
                  </Text>
                </View>
              </View>
            </View>

            {/* Histogramme */}
            <View style={statsStyles.card}>
              <View style={statsStyles.chartHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={statsStyles.cardTitle}>
                    {granularity === "week"
                      ? "Évolution journalière"
                      : granularity === "year"
                        ? "Évolution mensuelle"
                        : "Évolution hebdomadaire"}
                  </Text>
                  <Text style={statsStyles.cardSubtitle}>
                    {granularity === "week"
                      ? `Gains nets — ${periodLabel}`
                      : granularity === "year"
                        ? `Gains nets — ${periodLabel}`
                        : `Répartition des gains nets en ${periodLabel}`}
                  </Text>
                </View>
                <View style={statsStyles.chartCountPill}>
                  <Text style={statsStyles.chartCountText}>{bucketCountLabel}</Text>
                </View>
              </View>

              <View style={statsStyles.barsRow}>
                {report.buckets.map((b, i) => {
                  const isPic = i === report.picIndex && b.value > 0;
                  const h = Math.max(
                    Math.round((b.value / maxBucket) * 96),
                    b.value > 0 ? 8 : 3,
                  );
                  return (
                    <View key={b.key} style={statsStyles.barCol}>
                      {isPic && (
                        <View style={statsStyles.picPill}>
                          <MaterialIcons name="star" size={10} color="#92400E" />
                          <Text style={statsStyles.picPillText}>Pic</Text>
                        </View>
                      )}
                      <Text
                        style={[
                          statsStyles.barValue,
                          isPic && statsStyles.barValuePic,
                        ]}
                        numberOfLines={1}
                      >
                        {b.value >= 1000
                          ? `${Formatters.formatNumber(Math.round(b.value / 1000))}k`
                          : `${Formatters.formatNumber(Math.round(b.value))}`}
                      </Text>
                      <View
                        style={[
                          statsStyles.bar,
                          isPic && statsStyles.barPic,
                          { height: h },
                        ]}
                      />
                      <Text
                        style={[
                          statsStyles.barLabel,
                          isPic && statsStyles.barLabelPic,
                        ]}
                        numberOfLines={1}
                      >
                        {b.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={statsStyles.chartFoot}>
                <View style={statsStyles.chartFootLeft}>
                  <View style={statsStyles.chartFootDot} />
                  <Text style={statsStyles.chartFootText} numberOfLines={2}>
                    {report.bucketsTotal > 0
                      ? `Meilleure productivité : ${report.buckets[report.picIndex].label}`
                      : "Aucune activité sur la période"}
                  </Text>
                </View>
                <Text style={statsStyles.chartFootTotal}>
                  Total: {Formatters.formatNumber(Math.round(report.bucketsTotal / 1000))}k F
                </Text>
              </View>
            </View>

            {/* Paiements */}
            <View style={statsStyles.card}>
              <View>
                <Text style={statsStyles.cardTitle}>
                  Modes de paiement encaissés
                </Text>
                <Text style={statsStyles.cardSubtitle}>
                  Trésorerie globale collectée :{" "}
                  <Text style={{ fontWeight: "800", color: COLORS.white }}>
                    {Formatters.formatNumber(Math.round(report.treasury))} FCFA
                  </Text>
                </Text>
              </View>
              {report.payments.length > 0 ? (
                <>
                  <View style={statsStyles.segmentedBar}>
                    {report.payments.map((p) => (
                      <View
                        key={p.key}
                        style={{ width: `${Math.max(p.pct, 2)}%`, backgroundColor: p.color }}
                      />
                    ))}
                  </View>
                  {report.payments.map((p) => (
                    <View key={p.key} style={statsStyles.payRow}>
                      <View style={statsStyles.payLeft}>
                        <View style={[statsStyles.payIcon, { backgroundColor: p.bg }]}>
                          <MaterialIcons
                            name={p.icon as keyof typeof MaterialIcons.glyphMap}
                            size={20}
                            color={p.color}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={statsStyles.payName} numberOfLines={1}>
                            {p.label}
                          </Text>
                          <Text style={statsStyles.paySub}>
                            {Math.round(p.pct)}% • {p.count} course
                            {p.count > 1 ? "s" : ""}
                          </Text>
                        </View>
                      </View>
                      <View style={statsStyles.payRight}>
                        <Text style={statsStyles.payAmount}>
                          {Formatters.formatNumber(Math.round(p.amount))} F
                        </Text>
                        <Text style={[statsStyles.payTag, { color: p.color }]}>
                          {p.sub}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={statsStyles.cardSubtitle}>
                  Pas encore d&apos;encaissement sur cette période.
                </Text>
              )}
            </View>

            {/* Top marchands & zones */}
            <View style={statsStyles.card}>
              <View style={statsStyles.chartHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={statsStyles.cardTitle}>
                    Top Marchands & Communes
                  </Text>
                  <Text style={statsStyles.cardSubtitle}>
                    Tes principaux donneurs d&apos;ordres
                  </Text>
                </View>
                <MaterialIcons name="storefront" size={20} color={COLORS.muted} />
              </View>

              {report.merchants.length > 0 ? (
                report.merchants.map((m) => (
                  <View key={m.id} style={statsStyles.merchantRow}>
                    <View style={statsStyles.payLeft}>
                      <View style={statsStyles.merchantAvatar}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: COLORS.primary,
                          }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={statsStyles.payName} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text style={statsStyles.paySub}>
                          {m.deliveries} courses finalisées
                        </Text>
                      </View>
                    </View>
                    <View style={statsStyles.payRight}>
                      <Text style={[statsStyles.payAmount, { color: COLORS.primary }]}>
                        +{Formatters.formatNumber(Math.round(m.profit))} F
                      </Text>
                      <Text style={[statsStyles.payTag, { color: COLORS.muted }]}>
                        Gains net
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={statsStyles.cardSubtitle}>
                  Aucun marchand sur cette période.
                </Text>
              )}

              {report.zones.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={statsStyles.zoneLabel}>
                    Zones chaudes d&apos;Abidjan
                  </Text>
                  <View style={statsStyles.zoneGrid}>
                    {report.zones.map((z) => (
                      <View key={z.name} style={statsStyles.zoneCell}>
                        <View style={statsStyles.zoneLeft}>
                          <View
                            style={[statsStyles.zoneDot, { backgroundColor: z.color }]}
                          />
                          <Text style={statsStyles.zoneName} numberOfLines={1}>
                            {z.name}
                          </Text>
                        </View>
                        <Text style={statsStyles.zonePct}>
                          {Math.round(z.pct)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Audit & clôture — mois uniquement */}
            {report.granularity === "month" && (
              <View style={statsStyles.card}>
                <View style={statsStyles.auditHead}>
                  <View style={statsStyles.auditTitleRow}>
                    <View style={statsStyles.auditIcon}>
                      <MaterialIcons
                        name="verified-user"
                        size={18}
                        color={COLORS.primaryDark}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={statsStyles.cardTitle}>Audit Anti-Litige</Text>
                      <Text style={statsStyles.cardSubtitle}>
                        Conformité Trésorerie & Versements
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      statsStyles.readyPill,
                      isClosed && statsStyles.readyPillClosed,
                    ]}
                  >
                    {!isClosed && <View style={statsStyles.readyDot} />}
                    <Text
                      style={[
                        statsStyles.readyText,
                        isClosed && statsStyles.readyTextClosed,
                      ]}
                    >
                      {isClosed ? "Mois clôturé" : "Prêt pour la clôture"}
                    </Text>
                  </View>
                </View>

                <View style={statsStyles.auditRows}>
                  <View style={statsStyles.auditRow}>
                    <Text style={statsStyles.auditLabel}>
                      <MaterialIcons name="task-alt" size={15} color={COLORS.primary} />{" "}
                      Fonds reversés aux boutiques :
                    </Text>
                    <Text style={statsStyles.auditValue}>
                      {Formatters.formatNumber(Math.round(report.audit.reversed))} FCFA
                    </Text>
                  </View>
                  <View style={statsStyles.auditRow}>
                    <Text style={[statsStyles.auditLabel, { paddingLeft: 20 }]}>
                      Statut des reversements :
                    </Text>
                    {pendingAudit <= 0 ? (
                      <View style={statsStyles.upToDatePill}>
                        <Text style={statsStyles.upToDateText}>100% à jour</Text>
                      </View>
                    ) : (
                      <Text style={[statsStyles.auditValue, { color: COLORS.warning }]}>
                        Reste {Formatters.formatNumber(Math.round(pendingAudit))} F
                      </Text>
                    )}
                  </View>
                  <View style={statsStyles.auditRow}>
                    <Text style={statsStyles.auditLabel}>
                      <MaterialIcons name="swap-horiz" size={15} color="#B45309" />{" "}
                      Écarts imputés & justifiés :
                    </Text>
                    <Text
                      style={[
                        statsStyles.ecartValue,
                        report.audit.ecart === 0 && statsStyles.ecartOk,
                      ]}
                    >
                      {report.audit.ecart === 0
                        ? "0 FCFA ✓"
                        : `${report.audit.ecart > 0 ? "+" : "−"}${Formatters.formatNumber(Math.abs(report.audit.ecart))} FCFA`}
                    </Text>
                  </View>
                  <View style={statsStyles.auditRow}>
                    <Text style={[statsStyles.auditSub, { paddingLeft: 20 }]}>
                      {report.audit.ecart === 0
                        ? "Concordance auto vérifiée : encaissé = reversé + bénéfice"
                        : "Écart de concordance à justifier avant clôture"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    statsStyles.closeButton,
                    (isClosed || report.count === 0) &&
                      statsStyles.closeButtonDisabled,
                  ]}
                  onPress={() => setShowSheet(true)}
                  disabled={isClosed || report.count === 0}
                  activeOpacity={0.95}
                >
                  <MaterialIcons name="lock-reset" size={20} color="#FFFFFF" />
                  <Text style={statsStyles.closeButtonText}>
                    {isClosed
                      ? `${periodLabel} clôturé ✓`
                      : `Clôturer le mois de ${periodLabel} (${Formatters.formatNumber(Math.round(report.profit))} F)`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={statsStyles.shareButton}
                  onPress={handleShare}
                  disabled={isSharing || report.count === 0}
                  activeOpacity={0.85}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <MaterialIcons name="share" size={19} color={COLORS.primary} />
                  )}
                  <Text style={statsStyles.shareButtonText}>
                    Télécharger le pré-rapport PDF / WhatsApp
                  </Text>
                </TouchableOpacity>

                <Text style={statsStyles.auditNote}>
                  La clôture génère ton certificat infalsifiable Delygest pour
                  rassurer tes partenaires marchands.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom sheet de validation */}
      <Modal
        visible={showSheet}
        transparent
        animationType="slide"
        onRequestClose={() => !isClosing && setShowSheet(false)}
      >
        <View style={statsStyles.modalOverlay}>
          <View style={statsStyles.sheet}>
            <View style={statsStyles.dragHandle} />
            <View style={statsStyles.sheetHead}>
              <View style={statsStyles.sheetTitleRow}>
                <MaterialIcons name="verified" size={24} color={COLORS.primary} />
                <Text style={statsStyles.sheetTitle}>
                  Validation Clôture Définitive
                </Text>
              </View>
              <TouchableOpacity
                style={statsStyles.sheetClose}
                onPress={() => !isClosing && setShowSheet(false)}
                accessibilityLabel="Fermer"
              >
                <MaterialIcons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <Text style={statsStyles.sheetText}>
              Tu es sur le point de sceller tes comptes pour le mois de{" "}
              <Text style={statsStyles.sheetTextStrong}>{periodLabel}</Text>.
              Une fois validé, ton bénéfice net sera transféré vers ton solde
              sécurisé.
            </Text>
            {report && (
              <View style={statsStyles.sheetSummary}>
                <View style={statsStyles.sheetRow}>
                  <Text style={statsStyles.sheetLabel}>Bénéfice net certifié :</Text>
                  <Text style={[statsStyles.sheetValue, statsStyles.sheetValueGreen]}>
                    {Formatters.formatNumber(Math.round(report.profit))} FCFA
                  </Text>
                </View>
                <View style={statsStyles.sheetRow}>
                  <Text style={statsStyles.sheetLabel}>Courses marchands :</Text>
                  <Text style={statsStyles.sheetValue}>
                    {report.count} opérations
                  </Text>
                </View>
                <View style={statsStyles.sheetRow}>
                  <Text style={statsStyles.sheetLabel}>Reversements :</Text>
                  <Text style={[statsStyles.sheetValue, statsStyles.sheetValueGreen]}>
                    {pendingAudit <= 0
                      ? "100% à jour"
                      : `${Formatters.formatNumber(Math.round(pendingAudit))} F en attente`}
                  </Text>
                </View>
              </View>
            )}
            {!readyToClose && !isClosed && (
              <Text style={[statsStyles.sheetText, { color: COLORS.warning }]}>
                ⚠️ Des reversements sont en attente : la clôture les figera comme
                reversés. Vérifie ta trésorerie avant de confirmer.
              </Text>
            )}
            <TouchableOpacity
              style={[
                statsStyles.closeButton,
                isClosing && statsStyles.closeButtonDisabled,
              ]}
              onPress={handleCloseMonth}
              disabled={isClosing}
              activeOpacity={0.95}
            >
              {isClosing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="done-all" size={20} color="#FFFFFF" />
              )}
              <Text style={statsStyles.closeButtonText}>
                {isClosing ? "Enregistrement sécurisé…" : "Confirmer et sceller mon mois"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={statsStyles.sheetCancel}
              onPress={() => !isClosing && setShowSheet(false)}
              disabled={isClosing}
            >
              <Text style={statsStyles.sheetCancelText}>Revenir en arrière</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

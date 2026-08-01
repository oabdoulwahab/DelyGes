// src/constants/tutorials.ts
// Définition des tutoriels pour chaque écran de l'application

export type TutorialStep = {
  title: string;
  description: string;
  icon: string;
  position?: "top" | "center" | "bottom";
  targetId?: string;
  autoAdvance?: boolean;
  highlightPadding?: number;
};

export type Tutorial = {
  id: string;
  screen: string;
  title: string;
  steps: TutorialStep[];
};

export const TUTORIALS: Tutorial[] = [
  {
    id: "dashboard",
    screen: "dashboard",
    title: "Bienvenue sur votre tableau de bord",
    steps: [
      {
        title: "Objectif du jour",
        description:
          "Définissez votre objectif de gains quotidien en cliquant sur l'icône crayon. Suivez votre progression en temps réel avec la barre de progression.",
        icon: "flag",
        position: "top",
        targetId: "btn-edit-goal",
      },
      {
        title: "Revenus du jour",
        description:
          "Consultez vos revenus du jour, de la semaine et du mois. Le pourcentage indique votre évolution par rapport à hier.",
        icon: "account-balance-wallet",
        position: "center",
        targetId: "card-revenus",
      },
      {
        title: "Résumé financier",
        description:
          "Retrouvez le total encaissé, les montants à reverser aux commerçants, votre profit réel et les livraisons en attente de reversement.",
        icon: "account-balance",
        position: "center",
        targetId: "card-financial-summary",
      },
      {
        title: "Planning du jour",
        description:
          "Visualisez toutes vos livraisons planifiées aujourd'hui avec leur statut. Touchez une livraison pour voir les détails.",
        icon: "calendar-today",
        position: "bottom",
        targetId: "section-schedule",
      },
    ],
  },
  {
    id: "add-delivery",
    screen: "add-delivery",
    title: "Ajouter une livraison",
    steps: [
      {
        title: "Informations du destinataire",
        description:
          "Renseignez le nom, le téléphone et l'adresse du destinataire. Ces informations sont essentielles pour la livraison.",
        icon: "person",
        position: "top",
        targetId: "input-recipient-name",
      },
      {
        title: "Commerçant",
        description:
          "Sélectionnez le commerçant associé à la livraison. Commencez à taper le nom pour rechercher parmi vos commerçants enregistrés.",
        icon: "store",
        position: "center",
        targetId: "input-merchant-search",
      },
      {
        title: "Montants",
        description:
          "Indiquez la valeur du colis et les frais de livraison. Le profit est calculé automatiquement selon le type de paiement choisi.",
        icon: "payments",
        position: "center",
        targetId: "input-parcel-value",
      },
      {
        title: "Type de paiement",
        description:
          "Choisissez qui paie : le client paie tout, ou le commerçant paie les frais de livraison. Cela détermine les montants à encaisser et à reverser.",
        icon: "credit-card",
        position: "bottom",
        targetId: "selector-payment-type",
      },
    ],
  },
  {
    id: "merchant-accounting",
    screen: "merchant-accounting",
    title: "Comptabilité des commerçants",
    steps: [
      {
        title: "Vue par mois",
        description:
          "Consultez le récapitulatif mensuel : total encaissé, montants à reverser, profit et nombre de livraisons par mois.",
        icon: "calendar-month",
        position: "top",
        targetId: "tab-monthly",
      },
      {
        title: "Vue par commerçant",
        description:
          "Basculez sur la vue par commerçant pour voir le détail des livraisons et des montants pour chaque commerçant.",
        icon: "store",
        position: "center",
        targetId: "tab-merchant",
      },
      {
        title: "Reversements en attente",
        description:
          "La vue 'En attente' affiche les commerçants dont les reversements n'ont pas encore été effectués. Marquez-les comme reversés une fois le paiement fait.",
        icon: "pending-actions",
        position: "center",
        targetId: "tab-pending",
      },
      {
        title: "Filtres et recherche",
        description:
          "Utilisez la recherche et les filtres de date pour retrouver rapidement des livraisons spécifiques sur une période donnée.",
        icon: "filter-list",
        position: "bottom",
        targetId: "input-search",
      },
    ],
  },
  {
    id: "deliveries",
    screen: "deliveries",
    title: "Gestion des livraisons",
    steps: [
      {
        title: "Onglets de statut",
        description:
          "Naviguez entre les onglets : À livrer, Aujourd'hui, Livrées et Annulées pour filtrer vos livraisons par statut.",
        icon: "tab",
        position: "top",
        targetId: "tab-status",
      },
      {
        title: "Recherche",
        description:
          "Utilisez la barre de recherche pour trouver rapidement une livraison par nom de destinataire, téléphone ou adresse.",
        icon: "search",
        position: "top",
        targetId: "input-search",
      },
      {
        title: "Filtres de date",
        description:
          "Filtrez vos livraisons par période : aujourd'hui, cette semaine, ce mois ou une période personnalisée.",
        icon: "date-range",
        position: "center",
        targetId: "filter-date",
      },
      {
        title: "Actions sur les livraisons",
        description:
          "Touchez une livraison pour voir les détails, la marquer comme livrée ou l'annuler. Utilisez la sélection multiple pour des actions groupées.",
        icon: "touch-app",
        position: "bottom",
        targetId: "list-deliveries",
      },
    ],
  },
  {
    id: "settings",
    screen: "settings",
    title: "Paramètres du profil",
    steps: [
      {
        title: "Profil",
        description:
          "Modifiez vos informations personnelles : nom, téléphone, véhicule et numéro SIRET. Les changements sont sauvegardés automatiquement.",
        icon: "person",
        position: "top",
        targetId: "section-profile",
      },
      {
        title: "Configuration financière",
        description:
          "Activez ou désactivez l'assujettissement à la TVA selon votre statut fiscal.",
        icon: "percent",
        position: "center",
        targetId: "toggle-vat",
      },
      {
        title: "Objectifs",
        description:
          "Définissez vos objectifs de gains quotidiens et mensuels pour suivre votre performance et recevoir des notifications quand vous les atteignez.",
        icon: "flag",
        position: "center",
        targetId: "section-goals",
      },
      {
        title: "Notifications",
        description:
          "Gérez vos préférences de notifications : rappels de saisie, alertes de paiement et notification d'objectif atteint.",
        icon: "notifications",
        position: "center",
        targetId: "section-notifications",
      },
      {
        title: "Données et sécurité",
        description:
          "Exportez vos données en CSV, supprimez votre compte ou déconnectez-vous. Consultez les informations légales de l'application.",
        icon: "security",
        position: "bottom",
        targetId: "section-data-security",
      },
    ],
  },
];

// Clé de stockage pour mémoriser les tutoriels déjà vus
export const TUTORIAL_STORAGE_KEY = "tutorials_seen";
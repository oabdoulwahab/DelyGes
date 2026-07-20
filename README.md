# DelyGes

Application mobile de gestion de livraisons et de comptabilité pour livreurs indépendants. Construite avec React Native / Expo.

## Fonctionnalités

- **Dashboard** — Suivi en temps réel des revenus (jour, semaine, mois), objectifs journaliers, progression
- **Livraisons** — Gestion complète : ajout, modification, statuts (À livrer / Livrée / Annulée), recherche, filtres par période
- **Comptabilité commerçants** — Suivi des encaissements et reversements par commerçant, clôture mensuelle, vue "En cours / Par commerçant / Par mois"
- **Statistiques** — Graphiques d'évolution, répartition par type de paiement, zones top
- **Notifications** — Rappels d'inactivité, alertes d'objectif atteint, notifications push
- **Synchronisation Firebase** — Sauvegarde cloud, synchronisation automatique avec file d'attente et retry
- **Stockage local SQLite** — Base de données locale avec cache

## Stack technique

| Technologie | Version |
|-------------|---------|
| React Native | 0.81.5 |
| Expo SDK | 54 |
| TypeScript | 5.9 |
| SQLite (expo-sqlite) | 16.0 |
| Firebase Auth + Firestore | 12.12 |
| Expo Router (file-based) | 6.0 |
| Zustand | 5.0 |
| React Native Reanimated | 4.1 |
| date-fns | 4.1 |
| React Native SVG | 15.12 |

## Installation

```bash
npm install
npx expo start
```

Options : développement Android (`expo run:android`), iOS (`expo run:ios`), Expo Go.

## Structure du projet

```
app/                    # Écrans (file-based routing)
  _layout.tsx           # Layout racine avec providers + navigation
  index.tsx             # Point d'entrée (redirection auth)
  login.tsx / register.tsx / forgot-password.tsx
  dashboard.tsx         # Tableau de bord principal
  deliveries.tsx        # Liste des livraisons
  add-delivery.tsx      # Ajout / modification
  delivery/[id].tsx     # Détail livraison
  merchant-accounting.tsx  # Comptabilité commerçants
  stats.tsx             # Statistiques
  settings.tsx          # Paramètres utilisateur
  notifications.tsx / notification-settings.tsx

src/                    # Code métier
  config/firebase.ts    # Configuration Firebase
  context/AuthContext.tsx  # Contexte d'authentification
  database/db.ts        # Initialisation SQLite + migrations
  repositories/         # Couche d'accès aux données (CRUD)
  services/             # Logique métier + sync Firebase
  types/                # Types TypeScript
  utils/                # Formatters, helpers, cache

components/             # Composants réutilisables
  NavigationTabs.tsx    # Barre de navigation inférieure
  CustomModal.tsx       # Modale personnalisée (BlurView)
  DeliveryCard.tsx      # Carte de livraison (FlatList item)
  NotificationBadge.tsx # Badge de notifications non lues
  ErrorBoundary.tsx     # Gestionnaire d'erreurs global

providers/              # Providers React Context
  ModalProvider.tsx     # Gestion des modales (alerte, confirmation)

styles/                 # Feuilles de style par écran
  colors.ts, spacing.ts, typography.ts, common.ts
  dashboardStyles.ts, deliveriesStyles.ts, ...
```

## Scripts

```bash
npm start             # Expo dev server
npm run android       # Build Android
npm run ios           # Build iOS (macOS requis)
npm run lint          # ESLint
npm run deploy        # Déploiement EAS Update
npm run version:patch # Incrémente version patch
```

## Base de données locale

SQLite avec `expo-sqlite`. Tables principales : `deliveries`, `merchants`, `user`, `notifications`, `app_settings`, `settlements`, `sync_queue`. Migrations automatiques au démarrage.

## Synchronisation Firebase

Architecture offline-first avec file d'attente persistante (`sync_queue`). Les modifications locales sont marquées `needs_sync=1` et synchronisées en arrière-plan. Retry exponential backoff (max 5 tentatives).

## Licence

Projet privé.

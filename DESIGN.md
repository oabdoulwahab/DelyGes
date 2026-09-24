---
name: Terrain Courier
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4942'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6f7a71'
  outline-variant: '#bec9bf'
  surface-tint: '#0a6c44'
  primary: '#086b43'
  on-primary: '#ffffff'
  primary-container: '#2f855a'
  on-primary-container: '#ffffff'
  inverse-primary: '#83d8a6'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#845300'
  on-tertiary: '#ffffff'
  tertiary-container: '#a66900'
  on-tertiary-container: '#ffffff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9ff5c1'
  primary-fixed-dim: '#83d8a6'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#005231'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-currency:
    fontFamily: JetBrains Mono
    fontSize: 17px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.02em
  label-currency-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 30px
    letterSpacing: -0.03em
  label-badge:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '800'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-action:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
  label-micro:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is tailored specifically for motorcycle and van logistics couriers navigating high-density, rapidly evolving urban landscapes such as Abidjan, Côte d'Ivoire. The operating environment requires immediate information legibility under intense outdoor sunlight, high glare, variable network connectivity, and one-handed operation during deliveries.

The personality balances utilitarian efficiency with an approachable, fraternal camaraderie:
- **Tone:** Pragmatic, respectful, and direct. The interface uses the familiar French *tutoiement* ("tu") to build an encouraging, collaborative peer relationship ("Valide ta course", "Tu es hors-ligne").
- **Design Movement:** High-Contrast Tactical Minimalism. Clean white structural cards sit on a warm, earthy backdrop that minimizes ocular fatigue under full sunlight while grounding the interface in a tactile, real-world utility context. Surfaces emphasize low-elevation borders and rich background contrasts rather than fragile blurs or low-contrast gradients.
- **Form Factor Context:** Built natively for React Native/Expo on 360–390px portrait mobile screens, prioritizing thumb zones, 48px+ touch targets, and persistent state indicators.

## Colors

The palette is anchored by field-tested contrast ratios, balancing trust, environmental awareness, and instantaneous operational feedback.

### Brand & Interactive Colors
- **Primary (`#2F855A`):** Forest green conveying reliability, growth, and cash confirmation.
- **Primary Pressed (`#276E4C`):** Darkened green ensuring clear visual feedback on active touch states.
- **Primary Soft (`rgba(47, 133, 90, 0.12)`): Subtle tinted backing for selected chips, primary badges, and progress tracks.

### Base Canvas & Surfaces
- **Canvas Base (`#EFECE6`):** Warm, dusty neutral mimicking sunlit concrete and sand, eliminating pure-white glare outdoors.
- **Card Surface (`#FFFFFF`):** High-clarity foreground surface for deliverable parcel cards and operational sheets.
- **Card Sub-surface (`#F8FAFC`):** Neutral slate tint for secondary containers and metadata buckets.
- **Input Surface (`#F1F5F9`):** Soft, non-reflective background for form fields and search bars.

### Typography & Structure (Ink)
- **Ink Primary (`#0F172A`):** Deep slate black for absolute contrast on primary figures and headlines.
- **Ink Muted (`#64748B`):** Supporting slate gray for secondary labels, route stops, and contextual timestamps.
- **Border Default (`#E2E8F0`):** Crisp structural line defining card bounds and segment dividers.
- **Ink Placeholder (`#94A3B8`):** Muted field hint text meeting legibility requirements.

### Operational Status Tokens
- **Warning / À livrer:** Text/Icon `#F59E0B` on Background `#FEF3C7` (high ambient visibility for pending parcels).
- **Success / Livrée:** Text/Icon `#10B981` on Background `#D1FAE5` (clear terminal success).
- **Danger / Écart négatif:** Text/Icon `#EF4444` on Background `#FEE2E2` (cash discrepancies or failed runs).
- **Neutral / Annulée:** Text/Icon `#64748B` on Background `#F1F5F9` (archived, skipped, or abandoned jobs).
- **Info / Sync:** Text/Icon `#0284C7` on Background `#E0F2FE` (queue synchronization and telemetry).

## Typography

The typography strategy pairs **Plus Jakarta Sans** for rapid human parsing of names, instructions, and statuses with **JetBrains Mono** for financial reconciliation, package tracking codes, and offline state counters.

### Numerical and Financial Display Rules
- **FCFA Formats:** Currencies must always be rendered with non-breaking thin spaces separating thousands (e.g., `12 500 FCFA`, `1 000 000 FCFA`). Never split currency symbols onto a separate line.
- **Tabular Figures:** All financial amounts, queue counters, and customer telephone numbers must be styled with monospaced tabular figures (`JetBrains Mono` or `fontVariant: ['tabular-nums']` in React Native) to avoid jitter during real-time cache recalculations and delivery tallying.
- **Uppercase Badges:** Delivery status badges enforce full uppercase rendering with elevated letter spacing for instant recognition at arm's length while on a motorbike mount.

## Layout & Spacing

The spatial engine is built strictly for high-speed thumb navigation within 360–390px mobile viewports (e.g., standard Android and iOS devices prevalent in the regional market).

### Grid and Safe Area Architecture
- **Horizontal Screen Margins:** Standard canvas margin is strictly `1rem` (16px). This ensures maximum usable horizontal surface while avoiding edge accidental-touch triggers.
- **Vertical Rhythm:** Fixed `8pt` base grid rhythm (`space-xs`: 4px, `space-sm`: 8px, `space-md`: 12px, `space-lg`: 16px, `space-xl`: 24px).
- **Thumb Danger Zones:** Primary interactive CTAs must never sit inside the top 20% of the screen. Critical workflows anchor strictly to the bottom action bar.
- **Keyboard & Screen Offsets:** Input fields must integrate automatic scroll offsets with at least `space-xl` breathing room above software keyboards.

## Elevation & Depth

To remain responsive on entry-level Android devices and clearly visible under intense daylight, this design system avoids heavy blurred drop shadows or processor-heavy alpha composites. Depth is communicated structurally through layered surface tones and crisp borders.

- **Level 0 (Canvas Base):** Ground layer `#EFECE6`. Completely flat.
- **Level 1 (Cards & Lists):** Crisp `#FFFFFF` container with a 1px border of `#E2E8F0` and an ultra-subtle, sharp ambient drop: `offset: (0, 1)`, `opacity: 0.04`, `radius: 2`.
- **Level 2 (Active/Floating Elements & Action Bar):** Persistent action footers use `#FFFFFF` bordered top with `#E2E8F0` and a directional elevation: `offset: (0, -3)`, `opacity: 0.08`, `radius: 6`.
- **Level 3 (Modals & Bottom Sheets):** Deep sheet surface elevated above a high-contrast dim backdrop (`rgba(15, 23, 42, 0.45)`), demarcated with 1.5px top border accent in `#CBD5E1`.

## Shapes

The interface balances ergonomic softness with industrial precision using a standard base radius of 8px (`roundedness: 2`).

- **Base Cards & Containers:** 12px to 16px corner radius (`rounded-lg` to `rounded-xl`) giving a modern, friendly touch without sacrificing edge grid space.
- **Interactive Action Buttons:** 12px corner radius for standard buttons to maintain a balanced, tactile shape.
- **Pills & Status Badges:** Fully circular / pill-shaped (`radius: 9999px`) to differentiate discrete operational statuses from actionable square containers.
- **Bottom Sheets:** Top-left and top-right radii locked at 24px, bottom corners square at 0px.

## Components

### 1. Action Buttons
- **Primary CTA:** Minimum height 52px (strictly exceeding the 44px threshold). Background `#2F855A`, active pressed state `#276E4C`. Label in `Plus Jakarta Sans` 15px Bold `#FFFFFF`. Integrated loading indicator maintains fixed container geometry.
- **Secondary CTA:** Minimum height 48px. Background `#FFFFFF`, 1.5px border `#E2E8F0`, text `#0F172A`.
- **Destructive/Refusal CTA:** Background `#FEE2E2`, text `#EF4444`, pressed `#FECACA`.

### 2. Status Chips & Badges
- Compact capsules (`paddingVertical: 4px`, `paddingHorizontal: 8px`, border radius `9999px`).
- Always paired with a high-contrast dot (6px) or icon.
  - *À livrer:* `#FEF3C7` background, `#B45309` text.
  - *Livrée:* `#D1FAE5` background, `#047857` text.
  - *Écart négatif:* `#FEE2E2` background, `#B91C1C` text.
  - *Annulée:* `#F1F5F9` background, `#475569` text.

### 3. Parcel / Delivery Card
- Surface `#FFFFFF`, border 1px `#E2E8F0`, internal padding 16px, border radius 14px.
- **Card Header:** Customer neighborhood/commune in bold, tracking reference in `JetBrains Mono` muted.
- **Card Body:** Recipient name, tap-to-call icon (48x48px touch target with `#F1F5F9` background), destination address with directional pin.
- **Card Footer:** Bold tabular amount (`12 500 FCFA`) alongside an instant status pill.

### 4. Input Fields
- Minimum field height 48px. Background `#F1F5F9`, border 1px `#CBD5E1`, border radius 10px, padding horizontal 14px.
- Font size strictly 16px to prevent iOS auto-zoom behaviors.
- Placeholder text in `#94A3B8`. Focused state: border color `#2F855A` with 1.5px thickness.

### 5. Checkboxes & Radio Selection
- Checkbox size 24x24px within an expanded 48x48px hit slop. Active state `#2F855A` with bold white checkmark; inactive state `#FFFFFF` with 2px `#CBD5E1` border.

### 6. Offline Sync Pill (System Critical)
- Floating indicator anchored at the top right or within the header bar.
- **Online State:** Background `#D1FAE5`, text `#065F46`, green dot icon, text: "En ligne".
- **Offline / Syncing State:** Background `#E0F2FE`, text `#0369A1`, spinning icon, text: "3 en attente (Hors-ligne)".
- When offline, informs the courier that operations are preserved locally and safe to complete.

### 7. Bottom Action Bar & Modal Sheets
- **Bottom Action Bar:** Sticks directly above the device safe area. Houses full-width validation buttons ("Encaisser 12 500 FCFA", "Confirmer la livraison") ensuring natural thumb reach during transit.
- **Bottom Sheet Modal:** Used for delivery issue logs (e.g., "Client absent", "Numéro injoignable"). Drag handle indicator 36x4px `#CBD5E1`, top-rounded 24px, backdrop opacity 45%.
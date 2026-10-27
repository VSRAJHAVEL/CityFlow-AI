---
name: CityFlow AI Spatial System
colors:
  surface: '#131317'
  surface-dim: '#131317'
  surface-bright: '#39393d'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e7'
  on-surface-variant: '#c0c6d6'
  inverse-surface: '#e4e1e7'
  inverse-on-surface: '#303034'
  outline: '#8b91a0'
  outline-variant: '#414754'
  surface-tint: '#aac7ff'
  primary: '#aac7ff'
  on-primary: '#003064'
  primary-container: '#3e90ff'
  on-primary-container: '#002957'
  inverse-primary: '#005db8'
  secondary: '#e6feff'
  on-secondary: '#003739'
  secondary-container: '#00f4fe'
  on-secondary-container: '#006c71'
  tertiary: '#47e266'
  on-tertiary: '#003910'
  tertiary-container: '#00a73e'
  on-tertiary-container: '#00320d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00468d'
  secondary-fixed: '#63f7ff'
  secondary-fixed-dim: '#00dce5'
  on-secondary-fixed: '#002021'
  on-secondary-fixed-variant: '#004f53'
  tertiary-fixed: '#6cff82'
  tertiary-fixed-dim: '#47e266'
  on-tertiary-fixed: '#002106'
  on-tertiary-fixed-variant: '#00531a'
  background: '#131317'
  on-background: '#e4e1e7'
  surface-variant: '#353439'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '200'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '300'
    lineHeight: 44px
    letterSpacing: -0.02em
  metric-xl:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: '200'
    lineHeight: 48px
    letterSpacing: -0.025em
  metric-xl-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '300'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-telemetry:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

The design system embodies ambient intelligence, spatial clarity, and operational authority for next-generation municipal infrastructure monitoring. Drawing inspiration from Apple visionOS and macOS Sequoia, the aesthetic merges spatial glassmorphism with high-utility telemetry dashboards.

- **Aesthetic Direction:** Spatial glassmorphism with optic-grade refraction, delicate specular inner strokes, dynamic atmospheric depth, and bento-grid compartmentalization.
- **Atmospheric Canvas:** A foundational near-black field (`#0B0B0F`) enriched with ambient, slowly drifting indigo and cobalt luminance orbs (`#1E1E3F`, `#0A2540`) creating an optical volume behind translucent surfaces.
- **Emotional Intent:** Absolute poise under pressure, futuristic precision, optical calm, and hyper-reliable clarity for mission-critical urban oversight.

## Colors

The palette relies on absolute darkness for spatial depth, combined with crisp functional accents calibrated for low-light legibility and optical glow.

- **Primary Canvas & Surfaces:**
  - Background Base: `#0B0B0F`
  - Ambient Orbs: Drifting gradients between `#1A1B4B` (Deep Indigo) and `#0B2545` (Midnight Blue) with 40%–60% opacity and 120px Gaussian blur.
  - Glass Tier 1 (Background Shelves / Bento Base): `rgba(255, 255, 255, 0.04)` with `backdrop-filter: blur(40px) saturate(180%)`.
  - Glass Tier 2 (Panels / Popovers): `rgba(255, 255, 255, 0.07)` with `backdrop-filter: blur(28px) saturate(190%)`.
  - Glass Tier 3 (Raised Chips / Active Targets): `rgba(255, 255, 255, 0.12)` with `backdrop-filter: blur(20px) saturate(200%)`.
  - Specular Stroke: `rgba(255, 255, 255, 0.12)` (top edge), tapering to `rgba(255, 255, 255, 0.03)` (bottom edge).

- **System Accents & Telemetry:**
  - `Electric Blue (#0A84FF)`: Core AI processing, automated routing, and neural state indicators.
  - `Pulsing Cyan (#00F5FF)`: Priority transit corridors, autonomous fleet tracking, and active bypasses.
  - `Emerald Green (#30D158)`: Optimized flow, efficiency gains, and stable infrastructure nodes.
  - `Amber (#FF9F0A)`: Baseline operational thresholds, sensor degradation, and moderate latency.
  - `Crimson Red (#FF453A)`: High-priority grid collisions, severe bottlenecks, and dynamic emergency overrides.

- **Typography & Structural Neutrals:**
  - Label Primary: `rgba(255, 255, 255, 0.96)`
  - Label Secondary: `rgba(255, 255, 255, 0.64)`
  - Label Tertiary / Muted: `rgba(255, 255, 255, 0.40)`
  - Hairline Separators: `rgba(255, 255, 255, 0.08)`

## Typography

Typography prioritizes extreme metric legibility alongside whisper-quiet interface chrome, reflecting Sequoia and visionOS typographic weight hierarchies.

- **Numerical Telemetry:** Primary data metrics use ultralight weights (`200`–`300`) at scale (`44px`–`56px`) with negative tracking, echoing high-end flight instrumentation and luxury chronographs. Tabular figures (`tnum`) must be forced on all dynamic counters.
- **Hierarchy & Contrast:** Section headers maintain solid structural prominence (`500`–`600` weight) in pure white, while metadata, telemetry captions, and spatial labels use uppercase `label-sm` with widened letter-spacing (`0.04em`) in 40%–60% alpha channels.

## Layout & Spacing

The architectural layout utilizes an asymmetric bento grid that structures modular real-time telemetry into modular glass volumes.

- **Grid Architecture:**
  - **Desktop (macOS Sequoia HUD):** 12-column variable bento grid with `1.25rem` (20px) gutters and `2.5rem` outer margins. Panels span 3, 4, 6, 8, or 12 units. Modules maintain balanced proportional vertical cadence (e.g., 1:1 square micro-cards alongside 2:1 and 3:2 spatial map tiles).
  - **Tablet / Spatial (visionOS Floating Canvas):** 8-column layout with `1rem` gutters and `1.5rem` canvas clearance.
  - **Mobile:** 4-column stack; bento cells collapse gracefully into modular vertical cards with `1rem` gutters and margins.
- **Rhythm & Safe Insets:** All internal card padding defaults to `space-lg` (24px) to preserve internal breathability around glass borders. Compact secondary widgets utilize `space-md` (16px).

## Elevation & Depth

Spatial hierarchy is achieved through refractive optical layering, edge refraction, and multi-tier ambient shadows rather than pure opacity shifts.

- **Layer 0 (Canvas Base):** Solid `#0B0B0F` interrupted by soft radial background glows: `radial-gradient(circle at 20% 30%, rgba(10, 132, 255, 0.12), transparent 50%)` and `radial-gradient(circle at 80% 70%, rgba(30, 30, 63, 0.25), transparent 60%)`.
- **Layer 1 (Bento Cells / Root Glass):**
  - Surface: `rgba(255, 255, 255, 0.04)`
  - Blur: `backdrop-filter: blur(32px) saturate(180%)`
  - Border: 1px continuous solid border with linear gradient `border-image: linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.02) 100%) 1`
  - Cast Shadow: `0 20px 40px -10px rgba(0, 0, 0, 0.45), 0 0 1px 1px rgba(255, 255, 255, 0.05) inset`
- **Layer 2 (Floating Modals, Flyouts & Dynamic HUD Elements):**
  - Surface: `rgba(255, 255, 255, 0.08)`
  - Blur: `backdrop-filter: blur(40px) saturate(210%)`
  - Border: 1px specular highlight `rgba(255, 255, 255, 0.22)`
  - Cast Shadow: `0 30px 60px -12px rgba(0, 0, 0, 0.65), 0 0 20px rgba(10, 132, 255, 0.10)`
- **Hover & Interaction Shift:** Elements elevate dynamically upon gaze or cursor proximity by boosting specular border intensity to `rgba(255, 255, 255, 0.30)` and introducing an ambient accent inner glow (`0 0 16px rgba(10, 132, 255, 0.18)`).

## Shapes

The geometric signature mirrors macOS window squircles and visionOS volume boundaries, utilizing generous continuous-curvature radii (smooth Apple-style squircle corners).

- **Primary Bento Panels:** 24px (`rounded-xl` token tier) to 28px curvature to maintain organic spatial presence.
- **Internal Elements & Action Surfaces:** 12px–16px (`rounded-md` to `rounded-lg`) for sub-containers, inputs, and segment selectors.
- **Pills & Status Indicators:** Fully rounded concentric capsules (`9999px`) for streaming telemetry tags, incident level markers, and dynamic filter controls.

## Components

- **Buttons:**
  - *Primary (AI Execution):* Solid Electric Blue (`#0A84FF`) text or icon on `rgba(10, 132, 255, 0.16)` glass fill, framed by a 1px border of `rgba(10, 132, 255, 0.40)`. Hover shifts fill to `rgba(10, 132, 255, 0.28)` with a 12px outer glow (`#0A84FF33`).
  - *Secondary / Glass Pill:* Translucent fill `rgba(255, 255, 255, 0.06)`, specular border `rgba(255, 255, 255, 0.12)`, text white (`0.90` alpha). Active state tightens scale to `0.98`.
  - *Critical Override:* Deep crimson glass `rgba(255, 69, 58, 0.14)` with `#FF453A` specular rim.

- **Chips & Telemetry Badges:**
  - Pill capsules (`padding: 4px 10px`) equipped with a micro-beacon dot (6px).
  - *Emergency Transit:* `#00F5FF` beacon with continuous CSS ambient halo pulse (`animation: pulse 2s infinite`). Background `rgba(0, 245, 255, 0.08)`.
  - *Performance Gain:* `#30D158` beacon, tabular percentage readout (`+14.2%`).

- **Bento Cards & Data Panels:**
  - Modular cards with embedded top-edge specular illumination. Internal structure features a discrete top header bar separated by an ultra-thin hairline (`rgba(255, 255, 255, 0.06)`), housing uppercase `label-sm` taxonomy on the left and a glass control widget on the right.
  - Large numerical stat readouts anchor the visual weight, paired with Sparkline SVG tracks glowing in functional accent colors.

- **Lists & Telemetry Feeds:**
  - Borderless list rows floating over glass containers. Alternating rows rely on pure spacing rather than zebra backgrounds.
  - Hovering a row initiates a soft spotlight effect: `linear-gradient(90deg, rgba(255,255,255,0.06) 0%, transparent 100%)` with a left-edge 2px indicator bar colored by incident severity.

- **Input Fields & Search:**
  - Inset glass troughs: `rgba(0, 0, 0, 0.35)` background with an internal shadow (`inset 0 2px 4px rgba(0,0,0,0.5)`). Specular border `rgba(255, 255, 255, 0.08)`.
  - Focus state transitions border to Electric Blue (`#0A84FF`) with a diffused outer bloom `0 0 12px rgba(10, 132, 255, 0.25)`.

- **Checkboxes & Toggle Switches:**
  - *Switches (macOS/visionOS Hybrid):* 44x24px pill track in `rgba(255, 255, 255, 0.12)`. Active state transitions track to `#0A84FF`. Thumb is a luminous white optic disc (`#FFFFFF`) with a micro drop shadow.
  - *Checkboxes:* 18px squircle with subtle 1px border. Checked state transitions background to `#0A84FF` with an optic white checkmark icon.
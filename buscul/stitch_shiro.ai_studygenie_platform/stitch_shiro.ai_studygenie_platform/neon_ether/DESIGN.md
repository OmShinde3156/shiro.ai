# Design System Document: The Neon Curator

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Alchemist."** 

This is not a standard SaaS dashboard; it is a premium, high-fidelity environment designed to feel like a futuristic command center. We are moving away from the "flat web" by embracing depth, light emission, and editorial precision. The aesthetic breaks the traditional "box-and-grid" template by using intentional asymmetry, overlapping glass surfaces, and "light-leak" accents. We prioritize the content as if it were a curated exhibit, using high-contrast typography scales to guide the eye through complex AI-driven data.

---

## 2. Colors & Surface Architecture

### The Palette
The core of this system is a deep, immersive dark mode punctuated by high-energy neon signals.

*   **Primary (Neon Purple):** `#cc97ff` — Used for primary actions and "active" states.
*   **Secondary (Electric Cyan):** `#3adffa` — Used for secondary data points and success indicators.
*   **Tertiary (Soft Rose):** `#ff95a0` — Used for highlights and warning-adjacent states.
*   **Base Background:** `#0a0e18` (Surface / Surface Dim) — The infinite void upon which all elements float.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or layout containment. 
Structure is achieved through **Tonal Shifting**. A section is defined by moving from `surface` (#0a0e18) to `surface-container-low` (#0f131e). This creates a sophisticated, "borderless" look that feels expansive and expensive.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent materials.
*   **Level 0 (Foundation):** `surface` (#0a0e18)
*   **Level 1 (Sectioning):** `surface-container-low` (#0f131e)
*   **Level 2 (Cards/Modules):** `surface-container` (#151926)
*   **Level 3 (Popovers/Modals):** `surface-container-highest` (#202534)

### The Glass & Gradient Rule
To achieve the "Neon Curator" look, use `backdrop-blur-md` combined with `bg-white/5` (or `surface-variant` at 40% opacity) for floating interactive elements. 
**Signature Texture:** Primary CTAs should not be flat. Use a linear gradient from `primary` (#cc97ff) to `primary-dim` (#9c48ea) at a 135-degree angle to provide a sense of "glowing mass."

---

## 3. Typography
The system utilizes a dual-font strategy to balance futuristic character with professional readability.

*   **Display & Headlines (Manrope):** Chosen for its geometric, modern proportions. Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for hero sections to establish an editorial "voice."
*   **Body & Labels (Inter):** The workhorse font. Inter provides maximum legibility at small scales (875rem for `body-md`).
*   **Hierarchy as Brand:** Use `headline-sm` in `secondary` (Cyan) to label categories, creating a "data-tag" look that contrasts against the larger, white `display` text.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is communicated through light, not lines. When nesting a card within a sidebar, the card should be one "step" higher in the surface-container tier.

### Ambient Shadows
Forget dark grey shadows. In this system, shadows are "glowing voids."
*   **Shadow Specs:** `0px 20px 40px rgba(0, 0, 0, 0.4)` combined with a very subtle outer glow `0px 0px 15px rgba(168, 85, 247, 0.15)` for active primary elements.
*   **The Ghost Border:** If accessibility requires a stroke, use `outline-variant` at **15% opacity**. It should be felt, not seen.

### Glassmorphism Depth
Floating containers (Modals, Tooltips) must use:
*   `background: rgba(21, 25, 38, 0.7)`
*   `backdrop-filter: blur(12px)`
*   `border: 1px solid rgba(255, 255, 255, 0.05)`

---

## 5. Components

### Buttons
*   **Primary:** Rounded-xl, gradient fill (Primary to Primary-Dim), white text, subtle `primary-dim` outer glow on hover.
*   **Secondary (Neon Ghost):** Transparent background, `outline-variant` ghost border, `secondary` (Cyan) text.
*   **Tertiary:** No background, `on-surface-variant` text, underlining only on hover.

### Cards (The "Curator" Card)
*   **Style:** `surface-container` background, `rounded-xl` (1.5rem) corners.
*   **Constraint:** No dividers. Use `title-md` for headers and `body-sm` for content, separated by 1.5rem of vertical whitespace.

### Input Fields
*   **State:** Default state uses `surface-container-highest`. 
*   **Focus State:** The container background stays dark, but the "Ghost Border" transitions to 100% opacity `primary` with a 4px soft outer glow.

### Interactive Chips
*   Small, `rounded-full` capsules using `surface-variant`. When selected, they switch to `primary` with `on-primary` (deep purple) text.

### The "Pulse" Indicator
*   A custom component for Shiro.ai: A 6px dot using `secondary` with a concentric, animating ripple to indicate AI processing or "live" curation.

---

## 6. Do's and Don'ts

### Do
*   **Do** use extreme whitespace to separate unrelated concepts.
*   **Do** use "Neon Light Leaks" (large, 300px+ blurred circles of `#A855F7` at 5% opacity) in the background to break up large empty areas.
*   **Do** align text-heavy content to a strict editorial grid while allowing imagery and glass cards to break the margins slightly.

### Don't
*   **Don't** use pure black (#000000) for anything other than absolute shadows.
*   **Don't** use standard 1px dividers to separate list items; use a 4px-8px vertical gap instead.
*   **Don't** use high-saturation gradients for body text. Keep text colors within the `on-surface` and `on-surface-variant` range for readability.
*   **Don't** use sharp corners. Everything in this system follows the `rounded-xl` (1.5rem) or `rounded-lg` (1rem) philosophy to feel approachable yet tech-forward.
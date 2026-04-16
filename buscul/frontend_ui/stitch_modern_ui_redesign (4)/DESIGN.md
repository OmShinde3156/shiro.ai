# Design System Specification: High-End Learning Editorial

## 1. Overview & Creative North Star: "The Neon Curator"
This design system moves away from the traditional, boxy SaaS aesthetic seen in the reference materials. Instead of flat, disconnected modules, we are building **The Neon Curator**. This North Star represents an environment that feels like a premium, dark-mode editorial suite—intelligent, immersive, and sleek.

To break the "template" look, we employ:
*   **Intentional Asymmetry:** Avoid perfectly centered grids. Use organic spacing and unexpected overlaps to create a sense of bespoke craftsmanship.
*   **Tonal Depth:** Replacing harsh lines with light. We use the glow of AI (vibrant accents) to guide the eye, rather than rigid containers.
*   **Bespoke Glassmorphism:** Every floating element is treated as a physical pane of obsidian glass, refracting the vibrant energies of the platform.

---

## 2. Colors: Obsidian & Electric Pulse
The palette is rooted in deep, light-absorbing blacks, contrasted by high-energy accents that represent the "intelligence" of the AI.

### Core Palette (Material Design Tokens)
*   **Surface/Background:** `#0b0e14` (The Obsidian Base)
*   **Primary:** `#72dcff` (Electric Blue) — Use for primary CTAs and active states.
*   **Secondary:** `#dd8bfb` (Soft Purple) — Use for supplementary info like "Summaries" or "Flashcard" tags.
*   **Tertiary:** `#ff937a` (Coral/Orange) — Use for high-alert interactions or "New" highlights.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section off areas. Separation must be achieved via background shifts.
*   Place a `surface_container_low` card on a `surface` background.
*   Use `surface_container_highest` only for the most important interactive elements.

### Signature Textures
Main CTAs must use a linear gradient from `primary` (#72dcff) to `primary_container` (#00d2ff) at a 135-degree angle. This provides a "soul" to the buttons that flat color cannot replicate.

---

## 3. Typography: Editorial Authority
We pair **Manrope** (Display) with **Inter** (Functional) to balance technological precision with approachability.

*   **Display (Manrope):** Large, bold, and authoritative. Use `display-lg` (3.5rem) for dashboard greetings like "Hey, Learner."
*   **Headlines (Manrope):** Use `headline-sm` (1.5rem) for quiz questions to give them importance without cluttering the space.
*   **Body (Inter):** All reading material (summaries, flashcard content) uses `body-lg` (1rem) with a generous line height (1.6) to ensure long-form reading doesn't feel like a chore.
*   **Labels (Inter):** Use `label-sm` (0.6875rem) in all-caps with 5% letter spacing for secondary tools like "MIND MAPS" or "PROGRESS REPORT."

---

## 4. Elevation & Depth: The Layering Principle
We move beyond shadows to **Tonal Layering**.

*   **The Nesting Rule:** Instead of a flat grid, stack surfaces.
    *   *Base:* `surface`
    *   *Navigation Sidebar:* `surface_container_low`
    *   *Main Content Card:* `surface_container_high`
*   **Ambient Glows:** For floating "Flashcards," do not use black shadows. Use a 24px blur shadow with 8% opacity, tinted with the `primary` blue token. This mimics the light of the screen reflecting off a surface.
*   **Glassmorphism:** Use `surface_variant` at 60% opacity with a `20px` backdrop-blur for modals and tooltips. This ensures the dashboard content "bleeds" through, maintaining the user's context.
*   **The Ghost Border:** If a boundary is required for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient (`primary` to `primary_container`), `xl` (1.5rem) rounded corners. Hover state: Scale 1.02x with a soft `primary_dim` outer glow.
*   **Tertiary/Ghost:** No background. Text in `primary`. Hover: `surface_container_highest` background at 40% opacity.

### Learning Cards (Quiz/Flashcards)
*   **Styling:** No borders. Use `surface_container_high`. 
*   **Interactivity:** On hover, the card should lift using a 2px Y-axis shift and a subtle `secondary` glow.
*   **Spacing:** Enforce a strict `lg` (1rem) padding for internal content.

### Input Fields
*   **Style:** `surface_container_lowest` background. 
*   **Active State:** The "Ghost Border" becomes 100% opaque `primary` blue.
*   **Error State:** Text shifts to `error`, and the background gains a 2% `error_container` tint.

### Lists & Dividers
*   **Rule:** Forbid the use of divider lines.
*   **Alternative:** Use `md` (0.75rem) vertical white space between list items. Use a slight color shift (`surface_container_low` to `surface_container_high`) to denote a change in list sections.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use overlapping elements. A flashcard can slightly overlap the header area to create a sense of depth.
*   **Do** use `tertiary` (Coral) sparingly. It is a "spark" of color intended to draw the eye to the most critical action or new feature.
*   **Do** utilize the `full` (9999px) roundedness for small chips and tags, but stick to `xl` (1.5rem) for main containers.

### Don’t:
*   **Don't** use pure white (#FFFFFF) for text. Always use `on_surface` (#ecedf6) to reduce eye strain in the dark environment.
*   **Don't** use standard "drop shadows." If an element needs to pop, use a background color shift or an ambient glow.
*   **Don't** clutter the dashboard. If a tool isn't used frequently, tuck it into a glassmorphic "More" menu to maintain the spacious editorial feel.
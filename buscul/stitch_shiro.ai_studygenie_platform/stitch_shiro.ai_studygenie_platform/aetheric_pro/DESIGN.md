# Design System Strategy: The Cognitive Prism

## 1. Overview & Creative North Star
This design system is anchored by the Creative North Star: **"The Cognitive Prism."** 

In the context of an AI study companion, the interface must feel like an enlightened space—a digital tool that doesn't just store information but refines and projects it. We move beyond "standard" SaaS templates by embracing an editorial, high-tech aesthetic. This system prioritizes **Atmospheric Depth** over flat containers and **Intentional Asymmetry** over rigid grids. We achieve a premium feel by treating the screen as a series of layered light-refracting surfaces rather than a 2D canvas.

The goal is to evoke a sense of professional mastery and innovative fluidity. By utilizing high-contrast typography scales and overlapping elements, we create a signature look that feels "bespoke" and custom-engineered for the next generation of learners.

---

## 2. Colors & Atmospheric Depth
Our palette is a sophisticated interplay between the void of `Midnight Black` and the high-energy vibration of `Electric Purple` and `Neon Blue`.

### The Tonal Palette
- **Primary (`#3cd7ff`):** Our conduit for action. Use this for high-priority CTAs and interactive paths.
- **Secondary (`#dcb8ff`):** Our brand anchor. Reserved for logos, headers, and moments of creative insight.
- **Tertiary (`#8bdc00`):** The "Pulse." Use sparingly for success states, progress indicators, and "aha!" moments.
- **Surface (`#111125`):** The base of the prism. All depth is built upon this deep midnight foundation.

### The "No-Line" Rule
**Static 1px solid borders are strictly prohibited for sectioning.** To define boundaries, designers must use background color shifts. 
- *Implementation:* Use `surface-container-low` to house content on a `surface` background. The shift in value provides a sophisticated, "borderless" transition that feels more expansive and modern.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of frosted glass.
- **The Stacking Logic:** Place `surface-container-highest` elements (like active cards) on top of `surface-container-low` sections. This "nested" depth creates a natural hierarchy without visual clutter.

### The "Glass & Gradient" Rule
To elevate the experience from "app" to "experience," use Glassmorphism for floating elements (modals, navigation bars).
- **Signature Texture:** Apply a subtle linear gradient to main CTAs, transitioning from `primary` (#3cd7ff) to `primary-container` (#006d84) at a 135-degree angle. This provides a "soul" and professional luster that flat hex codes cannot achieve.

---

## 3. Typography: The Editorial Edge
We utilize a dual-font strategy to balance character with utility. **Manrope** provides a geometric, sophisticated personality for brand expression, while **Inter** handles high-density data.

- **Display Scales (`display-lg` to `display-sm`):** Use these for "Hero" moments. Tighten the letter spacing (kerning) by -2% to give headlines an authoritative, editorial feel. 
- **Headline & Title:** These are the anchors of our hierarchy. Use `headline-lg` (Manrope) for section starts to command attention.
- **Body & Label:** Use `body-lg` for general reading. For metadata and labels, switch to **Inter** (`label-md`) to provide a technical, high-tech contrast against the more organic Manrope.

**Hierarchy Tip:** Break the grid by occasionally offsetting a `display-lg` headline to the left of the main content column, creating a sophisticated asymmetrical rhythm common in high-end design journals.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often "muddy." In this system, we use **Tonal Layering** and **Ambient Shadows** to create lift.

- **The Layering Principle:** Depth is achieved by stacking the surface-container tokens. For example, a "Floating Action Button" should use `surface-bright` to naturally "pop" against a `surface-container-low` background.
- **Ambient Shadows:** When a shadow is required for extreme lift (e.g., a modal), use a large blur radius (30px+) with low opacity (6%). The shadow color must be a tinted version of `on-surface` (`#e2e0fc`) rather than pure black, mimicking how light refracts through dark glass.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.
- **Backdrop Blur:** Any element using a `surface-container` tier as a floating layer should implement a `backdrop-filter: blur(12px)`. This integrates the component into the environment rather than making it look "pasted on."

---

## 5. Component Logic

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), `md` (12px) rounding. No border. Text is `on-primary`.
- **Secondary:** Transparent background with a "Ghost Border" (`outline-variant` at 20%). On hover, fill with `primary` at 10% opacity.
- **Tertiary:** Text-only using `primary` color. High-density, high-intelligence.

### Cards & Containers
**Forbid the use of divider lines.** Use vertical white space (32px or 48px from the spacing scale) or a shift from `surface-container-low` to `surface-container-highest` to separate content blocks. 
- *Card Style:* `md` (12px) corner radius, `surface-container-low` background.

### Input Fields
Avoid the "boxy" look. Use a `surface-container-lowest` fill with a subtle `outline-variant` bottom-border (2px). When focused, the border transitions to a `primary` (#3cd7ff) glow.

### Additional Signature Component: The "Focus Glow" Chip
For AI-generated suggestions or study tags, use `secondary-container` with a `secondary` text color. Add a soft outer glow (0px 0px 8px) using the `secondary` color at 30% opacity to make the chip feel "energized" by AI.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use generous white space. High-tech doesn't mean "cluttered"; it means "precise."
- **Do** use asymmetry. Place an image or an AI-visualization slightly off-center to create visual interest.
- **Do** use the `tertiary` (Lime Green) color only for success or active progress to maintain its visual impact.

### Don't:
- **Don't** use 100% opaque borders or dividers. This breaks the "Cognitive Prism" illusion.
- **Don't** use "pure" black (#000000). Always use the `surface` token (#111125) to maintain tonal depth in the shadows.
- **Don't** use standard "drop shadows" with zero-offset; always favor background-color shifts first.
- **Don't** mix the rounding scales. Stick to `md` (12px) for cards and buttons to ensure a cohesive, intentional visual language.
# Design System Strategy: Celestial Cobalt

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Arctic Navigator."** 

We are evolving the dark-mode experience from a standard "deep black" void into a rich, high-contrast environment. This system pairs a deep, saturated cobalt foundation with stark white primary elements to create an interface that feels like high-precision instruments viewed through a frosted lens. It is a professional, high-performance aesthetic that emphasizes clarity and focus, rejecting muddy grays for a "Vibrant Tech" approach.

## 2. Colors: Tonal Atmosphere
The palette is rooted in a vibrant blue foundation, punctuated by pure white highlights and neon accents. This is a "Blue-Light" dark mode designed for high legibility.

### Core Palette (Material Tokens)
*   **Background / Neutral Base:** `#548cf5` (Deep Cobalt – The foundation of the UI)
*   **Primary:** `#ffffff` (Pure White – used for maximum contrast on key actions and critical text)
*   **Secondary:** `#dd8bfb` (Neon Magenta – used for creative highlights and AI-driven insights)
*   **Surface Container:** A tonal variation of the Cobalt base to maintain depth without losing the blue character.

### The "No-Line" Rule
To achieve a modern feel, **do not use 1px solid borders to define sections.**
*   **Shift Tones:** Use tonal shifts in the blue spectrum to separate a sidebar from the main content.
*   **Negative Space:** Utilize the moderate spacing scale to create clean breaks between content blocks.

### Surface Hierarchy & Nesting
The UI is treated as a series of structured blue layers.
1.  **Base Layer:** Neutral Cobalt (#548cf5).
2.  **Section Layer:** Slightly darker or more saturated blue variants.
3.  **Component Layer (Cards):** Elevated blue surfaces with subtle inner glows.
4.  **Active/Hover Layer:** Interaction states that shift toward the Secondary Magenta or Primary White.

### Signature Textures: Frost & Light
Replace standard shadows with "White Light" glows. For primary CTAs (White), use a subtle magenta outer glow to make the button "pop" against the cobalt background. Implement backdrop blurs (16px) on overlays to maintain the "Glass" feel, ensuring the blue foundation remains visible through the frost.

## 3. Typography: The Technical Edge
We use typography to establish authority. The contrast between geometric *Manrope* and the highly legible *Inter* creates a professional, tech-forward voice.

*   **Display (Manrope):** Use for "Hero" moments. Set with tight letter-spacing (-0.02em) in Pure White for a high-end look.
*   **Headlines (Manrope):** Bold, high-contrast markers.
*   **Body (Inter):** The workhorse for all educational content. Inter’s clarity is essential against the saturated blue background.
*   **Labels (Inter):** Uppercase with slight letter-spacing (+0.05em) for a technical, metadata-driven feel.

## 4. Elevation & Depth: Tonal Layering
In this system, elevation is defined by the purity of the color rather than just brightness.

*   **The Layering Principle:** Stack blue tiers to create depth. A card should be a distinct blue shade from its parent container.
*   **White Light Shadows:** Instead of black shadows, use semi-transparent white or light-blue glows to indicate elevation. 
*   **The "Glimmer" Edge:** If a container boundary is needed, use a white stroke at 10-15% opacity to create a "glass edge" effect.

## 5. Components: Modern Primitives

### Buttons
*   **Primary:** Pure White fill (#ffffff) with Cobalt text. High visibility, used for the main call to action.
*   **Secondary:** Magenta glass style. Background: `secondary_container` at 40% opacity with a solid Magenta text.
*   **Tertiary:** Outline style using the white "Glimmer" edge.

### Cards & Study Tools
*   **Cards:** Moderate (`2`) roundedness. No dividers. Use padding and blue-tonal shifts to separate header from body.
*   **Interactive Flashcards:** Use the moderate corner radius. Cards should use a slightly brighter blue than the background to appear "closer" to the user.
*   **Chips:** Pill-shaped. Use `secondary` (Magenta) for active states to provide a vibrant pop against the blue/white theme.

### Input Fields
*   **Search/Prompt:** Pill-shaped. Background should be a darker shade of Cobalt. On focus, the border should glow Pure White.

## 6. Do's and Don'ts

### Do
*   **Do** use Pure White for text that must be read immediately.
*   **Do** maintain the "Cobalt" identity; the UI should feel blue, not black or gray.
*   **Do** use the moderate (2) spacing scale to keep the interface balanced and efficient.
*   **Do** utilize Magenta for "magical" moments, such as AI completions or achievement badges.

### Don't
*   **Don't** use pure black or dark gray. It breaks the "Celestial Cobalt" atmosphere.
*   **Don't** use standard muddy drop shadows. Use light-based glows.
*   **Don't** use too many competing colors. Stick to the White/Blue/Magenta hierarchy.
*   **Don't** clutter the view. Even with "Normal" spacing, whitespace is key to maintaining the high-end feel.

---
**Director's Note:** This is a system of "Cold Precision." Every element should feel like it is glowing with its own internal light source. The shift from Cyan to White/Blue signals a transition from "Neon Cyberpunk" to a more "Refined Arctic Tech" aesthetic.
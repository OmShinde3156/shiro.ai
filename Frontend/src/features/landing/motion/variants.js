// Restrained, accessible motion variants for Shiro.ai Landing Page

export const checkReducedMotion = () => {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Subtle fade-up transition for section headers
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (customDelay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: customDelay,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

// Gentle container stagger for cards
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

// Subtle reveal for cards without excessive bounce
export const cardReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// Clean accordion collapse for FAQs
export const accordionTransition = {
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

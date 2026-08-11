'use client';

import { m } from 'framer-motion';
import { ReactNode } from 'react';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
    filter: 'blur(10px)',
  },
  in: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
  },
  out: {
    opacity: 0,
    y: -10,
    filter: 'blur(10px)',
  },
};

import { Transition } from 'framer-motion';

const pageTransition: Transition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.4,
};

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <m.div
      className="site-page"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{ width: '100%' }}
    >
      {children}
    </m.div>
  );
}

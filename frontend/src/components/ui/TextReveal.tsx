import { Fragment } from 'react';
import { Heading, type HeadingProps } from '@chakra-ui/react';
import type { Variants } from 'framer-motion';
import { MotionBox } from './motion';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: 'easeOut' } },
};

export interface TextRevealProps extends Omit<HeadingProps, 'children'> {
  text: string;
  /** Render with brand gradient text fill. */
  gradient?: boolean;
}

export function TextReveal({ text, gradient = false, as = 'h1', size = 'xl', ...rest }: TextRevealProps) {
  const words = text.split(' ');
  return (
    <Heading
      as={as}
      size={size}
      bgGradient={gradient ? 'linear(to-r, brand.500, accent.500)' : undefined}
      bgClip={gradient ? 'text' : undefined}
      {...rest}
    >
      <MotionBox as="span" display="inline" variants={container} initial="hidden" animate="show">
        {words.map((w, i) => (
          <Fragment key={`${w}-${i}`}>
            <MotionBox as="span" display="inline-block" variants={word}>
              {w}
            </MotionBox>
            {i < words.length - 1 ? ' ' : null}
          </Fragment>
        ))}
      </MotionBox>
    </Heading>
  );
}

export default TextReveal;

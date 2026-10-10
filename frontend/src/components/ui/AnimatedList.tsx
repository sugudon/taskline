import type { Key, ReactNode } from 'react';
import { AnimatePresence, type Variants } from 'framer-motion';
import { MotionBox, type MotionBoxProps } from './motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.15 } },
};

export interface AnimatedListProps<T> extends Omit<MotionBoxProps, 'children'> {
  items: readonly T[];
  keyExtractor: (item: T, index: number) => Key;
  renderItem: (item: T, index: number) => ReactNode;
  /** Chakra props applied to each item wrapper. */
  itemProps?: MotionBoxProps;
}

export function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  itemProps,
  ...rest
}: AnimatedListProps<T>) {
  return (
    <MotionBox
      variants={containerVariants}
      initial="hidden"
      animate="show"
      display="flex"
      flexDirection="column"
      gap={3}
      {...rest}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <MotionBox
            key={keyExtractor(item, index)}
            variants={itemVariants}
            exit="exit"
            layout
            {...itemProps}
          >
            {renderItem(item, index)}
          </MotionBox>
        ))}
      </AnimatePresence>
    </MotionBox>
  );
}

export default AnimatedList;

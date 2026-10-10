import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import {
  Box,
  Button,
  Flex,
  IconButton,
  type BoxProps,
  type ButtonProps,
  type FlexProps,
  type IconButtonProps,
} from '@chakra-ui/react';
import { motion, type MotionProps } from 'framer-motion';

/**
 * Chakra + Framer Motion bridge.
 * Motion props (initial/animate/whileHover/transition...) win over Chakra props
 * with the same name, so `transition` is always the framer-motion object.
 */
type Merge<P, M> = Omit<P, keyof M> & M;

export type MotionBoxProps = Merge<BoxProps, MotionProps>;
export type MotionFlexProps = Merge<FlexProps, MotionProps>;
export type MotionButtonProps = Merge<ButtonProps, MotionProps>;
export type MotionIconButtonProps = Merge<IconButtonProps, MotionProps>;

export const MotionBox = motion.create(Box) as unknown as ForwardRefExoticComponent<
  MotionBoxProps & RefAttributes<HTMLDivElement>
>;

export const MotionFlex = motion.create(Flex) as unknown as ForwardRefExoticComponent<
  MotionFlexProps & RefAttributes<HTMLDivElement>
>;

export const MotionButton = motion.create(Button) as unknown as ForwardRefExoticComponent<
  MotionButtonProps & RefAttributes<HTMLButtonElement>
>;

export const MotionIconButton = motion.create(IconButton) as unknown as ForwardRefExoticComponent<
  MotionIconButtonProps & RefAttributes<HTMLButtonElement>
>;

/** Shared interaction presets — every button uses these. */
export const buttonHover = { scale: 1.03, y: -2 } as const;
export const buttonTap = { scale: 0.97 } as const;
export const cardHover = { y: -6, boxShadow: '0 20px 40px -12px rgba(128, 90, 213, 0.35)' } as const;

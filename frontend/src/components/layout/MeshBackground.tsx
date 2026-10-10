import type { ReactNode } from 'react';
import { Box } from '@chakra-ui/react';
import { MotionBox } from '../ui/motion';

interface BlobConfig {
  color: string;
  size: string;
  top: string;
  left: string;
  duration: number;
}

const BLOBS: BlobConfig[] = [
  { color: 'brand.400', size: '420px', top: '-10%', left: '-5%', duration: 18 },
  { color: 'accent.400', size: '380px', top: '40%', left: '60%', duration: 22 },
  { color: 'blue.300', size: '320px', top: '70%', left: '5%', duration: 20 },
];

export interface MeshBackgroundProps {
  children?: ReactNode;
}

export function MeshBackground({ children }: MeshBackgroundProps) {
  return (
    <Box position="relative" minH="100vh" overflow="hidden" bg="bg.canvas">
      <Box position="absolute" inset={0} zIndex={0} pointerEvents="none" aria-hidden>
        {BLOBS.map((blob) => (
          <MotionBox
            key={`${blob.top}-${blob.left}`}
            position="absolute"
            top={blob.top}
            left={blob.left}
            w={blob.size}
            h={blob.size}
            borderRadius="full"
            bg={blob.color}
            opacity={0.35}
            filter="blur(80px)"
            animate={{ x: [0, 40, -30, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: blob.duration, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </Box>
      <Box position="relative" zIndex={1}>
        {children}
      </Box>
    </Box>
  );
}

export default MeshBackground;

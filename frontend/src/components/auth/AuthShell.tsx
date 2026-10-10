import type { ReactNode } from 'react';
import { Container, Text, VStack } from '@chakra-ui/react';
import { MeshBackground } from '../layout/MeshBackground';
import { PageWrapper } from '../layout/PageWrapper';
import { GlassCard } from '../ui/GlassCard';
import { TextReveal } from '../ui/TextReveal';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

/** Shared full-screen layout for public auth pages. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <MeshBackground>
      <PageWrapper>
        <Container maxW="md" py={{ base: 12, md: 20 }}>
          <VStack spacing={2} mb={6} textAlign="center">
            <Text
              fontSize="lg"
              fontWeight="extrabold"
              bgGradient="linear(to-r, brand.500, accent.500)"
              bgClip="text"
              letterSpacing="tight"
            >
              Taskline
            </Text>
          </VStack>
          <GlassCard p={{ base: 6, md: 8 }}>
            <TextReveal text={title} gradient size="xl" mb={subtitle ? 2 : 6} />
            {subtitle ? (
              <Text color="text.muted" mb={6}>
                {subtitle}
              </Text>
            ) : null}
            {children}
          </GlassCard>
        </Container>
      </PageWrapper>
    </MeshBackground>
  );
}

export default AuthShell;

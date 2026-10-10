import { useNavigate } from 'react-router';
import { Container, Text, VStack } from '@chakra-ui/react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { MeshBackground } from '../components/layout/MeshBackground';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { TextReveal } from '../components/ui/TextReveal';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <MeshBackground>
      <PageWrapper>
        <Container maxW="md" py={24}>
          <GlassCard isStatic textAlign="center">
            <VStack spacing={4}>
              <Text fontSize="6xl" fontWeight="extrabold" color="brand.500">
                404
              </Text>
              <TextReveal text="Page not found" size="lg" />
              <Text color="text.muted">The page you're looking for doesn't exist or was moved.</Text>
              <GradientButton onClick={() => navigate('/dashboard')}>Back to dashboard</GradientButton>
            </VStack>
          </GlassCard>
        </Container>
      </PageWrapper>
    </MeshBackground>
  );
}

export default NotFoundPage;

import { Center, Spinner, Text, VStack } from '@chakra-ui/react';

export interface LoadingStateProps {
  label?: string;
  fullScreen?: boolean;
}

export function LoadingState({ label = 'Loading...', fullScreen = false }: LoadingStateProps) {
  return (
    <Center minH={fullScreen ? '100vh' : '200px'} w="full" role="status" aria-live="polite">
      <VStack spacing={3}>
        <Spinner size="xl" thickness="4px" color="brand.500" emptyColor="brand.100" speed="0.7s" />
        <Text color="text.muted" fontSize="sm">
          {label}
        </Text>
      </VStack>
    </Center>
  );
}

export default LoadingState;

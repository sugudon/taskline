import { Divider, HStack, Text } from '@chakra-ui/react';

export interface AuthDividerProps {
  label?: string;
}

export function AuthDivider({ label = 'or' }: AuthDividerProps) {
  return (
    <HStack w="full" spacing={3} my={6} aria-hidden>
      <Divider borderColor="border.subtle" />
      <Text fontSize="sm" color="text.muted" flexShrink={0}>
        {label}
      </Text>
      <Divider borderColor="border.subtle" />
    </HStack>
  );
}

export default AuthDivider;

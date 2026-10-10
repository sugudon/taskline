import { HStack, Text } from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { AnimatedButton } from '../ui/AnimatedButton';

export interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  isFetching?: boolean;
}

export function Pagination({ page, pages, total, onPageChange, isFetching = false }: PaginationProps) {
  const lastPage = Math.max(pages, 1);
  return (
    <HStack justify="space-between" mt={6} spacing={4} wrap="wrap" as="nav" aria-label="Pagination">
      <Text fontSize="sm" color="text.muted">
        {total} {total === 1 ? 'assignment' : 'assignments'}
      </Text>
      <HStack spacing={3}>
        <AnimatedButton
          size="sm"
          variant="outline"
          leftIcon={<ChevronLeftIcon />}
          onClick={() => onPageChange(page - 1)}
          isDisabled={page <= 1 || isFetching}
        >
          Prev
        </AnimatedButton>
        <Text fontSize="sm" fontWeight="medium" aria-live="polite">
          Page {Math.min(page, lastPage)} of {lastPage}
        </Text>
        <AnimatedButton
          size="sm"
          variant="outline"
          rightIcon={<ChevronRightIcon />}
          onClick={() => onPageChange(page + 1)}
          isDisabled={page >= lastPage || isFetching}
        >
          Next
        </AnimatedButton>
      </HStack>
    </HStack>
  );
}

export default Pagination;

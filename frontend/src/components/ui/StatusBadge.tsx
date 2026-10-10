import { Badge, type BadgeProps } from '@chakra-ui/react';
import { STATUS_COLORS, STATUS_LABELS } from '../../lib/constants';
import type { AssignmentStatus } from '../../types';

export interface StatusBadgeProps extends BadgeProps {
  status: AssignmentStatus;
}

export function StatusBadge({ status, ...rest }: StatusBadgeProps) {
  return (
    <Badge colorScheme={STATUS_COLORS[status]} variant="subtle" data-status={status} {...rest}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export default StatusBadge;

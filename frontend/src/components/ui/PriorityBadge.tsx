import { Badge, type BadgeProps } from '@chakra-ui/react';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants';
import type { AssignmentPriority } from '../../types';

export interface PriorityBadgeProps extends BadgeProps {
  priority: AssignmentPriority;
}

export function PriorityBadge({ priority, ...rest }: PriorityBadgeProps) {
  return (
    <Badge
      colorScheme={PRIORITY_COLORS[priority]}
      variant={priority === 'urgent' ? 'solid' : 'outline'}
      data-priority={priority}
      {...rest}
    >
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export default PriorityBadge;

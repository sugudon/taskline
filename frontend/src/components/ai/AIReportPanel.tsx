import {
  Alert,
  AlertDescription,
  AlertIcon,
  Heading,
  HStack,
  List,
  ListItem,
  Text,
  VStack,
} from '@chakra-ui/react';
import { GlassCard } from '../ui/GlassCard';
import { AnimatedButton } from '../ui/AnimatedButton';
import { useGenerateReport } from '../../hooks/useAi';
import { getErrorMessage } from '../../services/api';
import type { ProjectReport } from '../../types';

export interface AIReportPanelProps {
  projectId: number;
}

const SECTIONS: { key: keyof Omit<ProjectReport, 'headline' | 'generated_at'>; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'at_risk', label: 'At risk' },
  { key: 'next_steps', label: 'Next steps' },
  { key: 'workload', label: 'Workload' },
];

export function AIReportPanel({ projectId }: AIReportPanelProps) {
  const report = useGenerateReport(projectId);
  const data = report.data;

  return (
    <GlassCard isStatic data-testid="ai-report">
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between">
          <Heading size="sm">AI status report</Heading>
          <AnimatedButton
            size="sm"
            variant="outline"
            onClick={() => report.mutate()}
            isLoading={report.isPending}
            loadingText="Summarizing..."
          >
            {data ? 'Refresh' : 'Summarize'}
          </AnimatedButton>
        </HStack>
        {report.isError ? (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            <AlertDescription>{getErrorMessage(report.error)}</AlertDescription>
          </Alert>
        ) : null}
        {data ? (
          <VStack align="stretch" spacing={3}>
            <Text fontWeight="semibold">{data.headline}</Text>
            {SECTIONS.filter(({ key }) => data[key].length > 0).map(({ key, label }) => (
              <VStack key={key} align="stretch" spacing={1}>
                <Text fontSize="sm" fontWeight="semibold" color="text.muted">
                  {label}
                </Text>
                <List spacing={1} styleType="disc" pl={5} fontSize="sm">
                  {data[key].map((line) => (
                    <ListItem key={line}>{line}</ListItem>
                  ))}
                </List>
              </VStack>
            ))}
            <Text fontSize="xs" color="text.muted">
              Generated {new Date(data.generated_at).toLocaleString()} · AI can make mistakes.
            </Text>
          </VStack>
        ) : !report.isError ? (
          <Text fontSize="sm" color="text.muted">
            Get a quick summary of progress, risks and next steps. Project data is sent to OpenAI.
          </Text>
        ) : null}
      </VStack>
    </GlassCard>
  );
}

export default AIReportPanel;

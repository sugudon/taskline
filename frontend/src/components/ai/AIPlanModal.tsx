import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Checkbox,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { AnimatedButton } from '../ui/AnimatedButton';
import { useApplyPlan, useGeneratePlan } from '../../hooks/useAi';
import { getErrorMessage } from '../../services/api';
import { ASSIGNMENT_PRIORITIES, PRIORITY_LABELS } from '../../lib/constants';
import type {
  AssignmentPriority,
  PlanDraftItem,
  PlanItem,
  ProjectMemberResponse,
} from '../../types';

export interface AIPlanModalProps {
  projectId: number;
  members: ProjectMemberResponse[];
  isOpen: boolean;
  onClose: () => void;
}

interface DraftRow extends PlanDraftItem {
  key: number;
  include: boolean;
}

const memberName = (m: ProjectMemberResponse): string => m.user.full_name ?? m.user.email;

export function AIPlanModal({ projectId, members, isOpen, onClose }: AIPlanModalProps) {
  const toast = useToast();
  const generate = useGeneratePlan(projectId);
  const apply = useApplyPlan(projectId);
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxItems, setMaxItems] = useState(8);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [notes, setNotes] = useState<string | null>(null);

  const reset = (): void => {
    setRows([]);
    setNotes(null);
    generate.reset();
    apply.reset();
  };

  const handleClose = (): void => {
    reset();
    setGoal('');
    setDeadline('');
    onClose();
  };

  const handleGenerate = (event: FormEvent): void => {
    event.preventDefault();
    generate.mutate(
      { goal: goal.trim(), deadline: deadline || null, max_items: maxItems },
      {
        onSuccess: (draft) => {
          setRows(draft.items.map((item, index) => ({ ...item, key: index, include: true })));
          setNotes(draft.notes);
        },
      },
    );
  };

  const updateRow = (key: number, patch: Partial<DraftRow>): void => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const selected = rows.filter((row) => row.include && row.title.trim());

  const handleApply = (): void => {
    const items: PlanItem[] = selected.map((row) => ({
      title: row.title.trim(),
      description: row.description,
      priority: row.priority,
      due_date: row.due_date,
      assignee_id: row.assignee_id,
    }));
    apply.mutate(items, {
      onSuccess: (created) => {
        toast({ status: 'success', title: `Added ${created.length} assignments` });
        handleClose();
      },
    });
  };

  const error = generate.error ?? apply.error;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="3xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Plan with AI</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {rows.length === 0 ? (
              <Box as="form" id="ai-plan-form" onSubmit={handleGenerate}>
                <VStack align="stretch" spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>What do you want to get done?</FormLabel>
                    <Textarea
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="e.g. Launch the new marketing site with a blog and contact form"
                      maxLength={2000}
                      rows={4}
                    />
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Deadline (optional)</FormLabel>
                      <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Max assignments</FormLabel>
                      <NumberInput
                        min={3}
                        max={20}
                        value={maxItems}
                        onChange={(_, value) => setMaxItems(Number.isNaN(value) ? 8 : value)}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                  </SimpleGrid>
                  <Text fontSize="sm" color="text.muted">
                    The goal plus this project&apos;s members and assignment titles are sent to OpenAI
                    to draft the plan. Nothing is saved until you review it.
                  </Text>
                </VStack>
              </Box>
            ) : (
              <VStack align="stretch" spacing={3}>
                {notes ? (
                  <Alert status="info" borderRadius="lg">
                    <AlertIcon />
                    <AlertDescription>{notes}</AlertDescription>
                  </Alert>
                ) : null}
                {rows.map((row) => (
                  <Box
                    key={row.key}
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderRadius="lg"
                    p={3}
                    opacity={row.include ? 1 : 0.5}
                    data-testid="plan-row"
                  >
                    <HStack align="start" spacing={3}>
                      <Checkbox
                        mt={2}
                        isChecked={row.include}
                        onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                        aria-label={`Include ${row.title}`}
                      />
                      <VStack align="stretch" spacing={2} flex={1}>
                        <Input
                          value={row.title}
                          onChange={(e) => updateRow(row.key, { title: e.target.value })}
                          maxLength={200}
                          fontWeight="semibold"
                          aria-label="Title"
                        />
                        {row.description ? (
                          <Text fontSize="sm" color="text.muted">
                            {row.description}
                          </Text>
                        ) : null}
                        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={2}>
                          <Select
                            size="sm"
                            value={row.priority}
                            onChange={(e) =>
                              updateRow(row.key, { priority: e.target.value as AssignmentPriority })
                            }
                            aria-label="Priority"
                          >
                            {ASSIGNMENT_PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {PRIORITY_LABELS[p]}
                              </option>
                            ))}
                          </Select>
                          <Input
                            size="sm"
                            type="date"
                            value={row.due_date ?? ''}
                            onChange={(e) => updateRow(row.key, { due_date: e.target.value || null })}
                            aria-label="Due date"
                          />
                          <Select
                            size="sm"
                            value={row.assignee_id ?? ''}
                            onChange={(e) =>
                              updateRow(row.key, {
                                assignee_id: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            aria-label="Assignee"
                          >
                            <option value="">Unassigned</option>
                            {members.map((m) => (
                              <option key={m.user.id} value={m.user.id}>
                                {memberName(m)}
                              </option>
                            ))}
                          </Select>
                        </SimpleGrid>
                        {row.rationale ? (
                          <Text fontSize="xs" color="text.muted">
                            Why: {row.rationale}
                          </Text>
                        ) : null}
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
            {error ? (
              <Alert status="error" borderRadius="lg">
                <AlertIcon />
                <AlertDescription>{getErrorMessage(error)}</AlertDescription>
              </Alert>
            ) : null}
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          {rows.length === 0 ? (
            <>
              <AnimatedButton variant="ghost" onClick={handleClose}>
                Cancel
              </AnimatedButton>
              <GradientButton
                type="submit"
                form="ai-plan-form"
                isLoading={generate.isPending}
                loadingText="Drafting..."
                isDisabled={goal.trim().length < 3}
              >
                Draft plan
              </GradientButton>
            </>
          ) : (
            <>
              <AnimatedButton variant="ghost" onClick={reset} isDisabled={apply.isPending}>
                Start over
              </AnimatedButton>
              <GradientButton
                onClick={handleApply}
                isLoading={apply.isPending}
                isDisabled={selected.length === 0}
              >
                Add {selected.length} assignment{selected.length === 1 ? '' : 's'}
              </GradientButton>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default AIPlanModal;

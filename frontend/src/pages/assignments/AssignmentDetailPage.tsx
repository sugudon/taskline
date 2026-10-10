import { useNavigate, useParams, Link as RouterLink } from 'react-router';
import {
  Badge,
  Divider,
  Grid,
  GridItem,
  Heading,
  HStack,
  Link,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import { isAxiosError } from 'axios';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { GlassCard } from '../../components/ui/GlassCard';
import { AnimatedButton } from '../../components/ui/AnimatedButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { AssignmentHeader } from '../../components/assignments/AssignmentHeader';
import { StatusSelect } from '../../components/assignments/StatusSelect';
import { AssigneeSelect } from '../../components/assignments/AssigneeSelect';
import { CommentThread } from '../../components/assignments/CommentThread';
import { CommentForm } from '../../components/assignments/CommentForm';
import { useAssignment, useComments, useDeleteAssignment } from '../../hooks/useAssignments';
import { useProject } from '../../hooks/useProjects';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../services/api';

export function AssignmentDetailPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const assignmentId = Number(id);
  const validId = Number.isInteger(assignmentId) && assignmentId > 0;

  const { data: assignment, isLoading, isError, error } = useAssignment(validId ? assignmentId : undefined);
  const { data: comments, isLoading: commentsLoading } = useComments(assignment ? assignment.id : undefined);
  const { data: project } = useProject(assignment?.project_id);
  const deleteAssignment = useDeleteAssignment();
  const confirm = useDisclosure();

  const notFound = !validId || (isError && isAxiosError(error) && error.response?.status === 404);

  if (notFound) {
    return (
      <PageWrapper>
        <EmptyState
          icon="🧭"
          title="Assignment not found"
          description="It may have been deleted, or you don't have access to its project."
          actionLabel="Back to assignments"
          onAction={() => navigate('/assignments')}
        />
      </PageWrapper>
    );
  }

  if (isLoading) {
    return (
      <PageWrapper>
        <LoadingState label="Loading assignment..." />
      </PageWrapper>
    );
  }

  if (isError || !assignment) {
    return (
      <PageWrapper>
        <EmptyState
          icon="⚠"
          title="Couldn't load assignment"
          description={getErrorMessage(error)}
          actionLabel="Back to assignments"
          onAction={() => navigate('/assignments')}
        />
      </PageWrapper>
    );
  }

  const isOwner = Boolean(user && project && project.owner_id === user.id);
  const isCreator = Boolean(user && assignment.created_by && assignment.created_by.id === user.id);
  const isAssignee = Boolean(user && assignment.assignee?.id === user.id);
  const canEdit = isCreator || isAssignee || isOwner;
  const canDelete = isCreator || isOwner;
  // Only the Scrum master (project owner) or the task's creator may reassign it.
  const canReassign = isCreator || isOwner;
  const isArchived = Boolean(project?.is_archived);

  const handleDelete = () => {
    deleteAssignment.mutate(assignment.id, {
      onSuccess: () => {
        confirm.onClose();
        toast({ status: 'success', title: 'Assignment deleted', duration: 2500 });
        navigate('/assignments', { replace: true });
      },
      onError: (err) => {
        toast({ status: 'error', title: 'Could not delete assignment', description: getErrorMessage(err) });
      },
    });
  };

  const actions =
    canEdit || canDelete ? (
      <>
        {canEdit ? (
          <AnimatedButton
            variant="outline"
            leftIcon={<EditIcon />}
            onClick={() => navigate(`/assignments/${assignment.id}/edit`)}
          >
            Edit
          </AnimatedButton>
        ) : null}
        {canDelete ? (
          <AnimatedButton variant="ghost" colorScheme="red" leftIcon={<DeleteIcon />} onClick={confirm.onOpen}>
            Delete
          </AnimatedButton>
        ) : null}
      </>
    ) : null;

  return (
    <PageWrapper>
      <Link
        as={RouterLink}
        to="/assignments"
        display="inline-flex"
        alignItems="center"
        gap={1}
        mb={4}
        fontSize="sm"
        color="text.muted"
        _hover={{ color: 'brand.500' }}
      >
        <ArrowBackIcon /> All assignments
      </Link>

      <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6} alignItems="start">
        <GridItem minW={0}>
          <Stack spacing={6}>
            <GlassCard isStatic>
              <AssignmentHeader assignment={assignment} actions={actions} />
            </GlassCard>

            <GlassCard isStatic>
              <HStack mb={4} spacing={2}>
                <Heading size="md">Comments</Heading>
                <Badge colorScheme="brand" variant="subtle">
                  {comments?.length ?? assignment.comment_count}
                </Badge>
              </HStack>
              {commentsLoading ? (
                <LoadingState label="Loading comments..." />
              ) : (
                <CommentThread
                  assignmentId={assignment.id}
                  comments={comments ?? []}
                  currentUserId={user?.id}
                />
              )}
              <Divider my={5} />
              {isArchived ? (
                <Text fontSize="sm" color="text.muted" mb={3} data-testid="archived-comment-note">
                  This project is archived — new comments are disabled.
                </Text>
              ) : null}
              <CommentForm assignmentId={assignment.id} isDisabled={isArchived} />
            </GlassCard>
          </Stack>
        </GridItem>

        <GridItem>
          <GlassCard>
            <Stack spacing={5}>
              <Heading size="sm" textTransform="uppercase" letterSpacing="wide" color="text.muted">
                Details
              </Heading>
              <StatusSelect assignment={assignment} isDisabled={isArchived} />
              <AssigneeSelect assignment={assignment} isDisabled={isArchived || !canReassign} />
              <Text fontSize="xs" color="text.muted">
                {isArchived
                  ? 'This project is archived, so status and assignee can no longer be changed.'
                  : canReassign
                    ? 'Any project member can change the status. You can reassign this task.'
                    : 'Any project member can change the status. Only the Scrum master or the task creator can reassign it.'}
              </Text>
            </Stack>
          </GlassCard>
        </GridItem>
      </Grid>

      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={confirm.onClose}
        onConfirm={handleDelete}
        isLoading={deleteAssignment.isPending}
        title="Delete assignment?"
        body={
          <Text>
            <Text as="span" fontWeight="semibold">
              {assignment.title}
            </Text>{' '}
            and all of its comments will be permanently deleted.
          </Text>
        }
        confirmLabel="Delete"
      />
    </PageWrapper>
  );
}

export default AssignmentDetailPage;

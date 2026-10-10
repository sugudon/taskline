import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { chakra, FormControl, FormErrorMessage, HStack, Text, Textarea, useToast } from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { useAddComment } from '../../hooks/useAssignments';
import { getErrorMessage } from '../../services/api';
import { COMMENT_MAX } from './utils';

export interface CommentFormProps {
  assignmentId: number;
  /** e.g. when the project is archived (read-only). */
  isDisabled?: boolean;
}

export function CommentForm({ assignmentId, isDisabled = false }: CommentFormProps) {
  const toast = useToast();
  const addComment = useAddComment(assignmentId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (isDisabled) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Write something first');
      return;
    }
    if (trimmed.length > COMMENT_MAX) {
      setError(`Comments are limited to ${COMMENT_MAX} characters`);
      return;
    }
    addComment.mutate(trimmed, {
      onSuccess: () => {
        setBody('');
        setError(undefined);
      },
      onError: (err) =>
        toast({ status: 'error', title: 'Could not post comment', description: getErrorMessage(err) }),
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <chakra.form onSubmit={handleSubmit} noValidate>
      <FormControl isInvalid={Boolean(error)}>
        <Textarea
          aria-label="Add a comment"
          placeholder="Add a comment... (Ctrl/⌘ + Enter to post)"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(undefined);
          }}
          onKeyDown={handleKeyDown}
          rows={3}
          borderRadius="xl"
          bg="bg.surface"
          maxLength={COMMENT_MAX}
          isDisabled={isDisabled}
        />
        {error ? <FormErrorMessage>{error}</FormErrorMessage> : null}
      </FormControl>
      <HStack justify="space-between" mt={3}>
        <Text fontSize="xs" color="text.muted">
          {body.length}/{COMMENT_MAX}
        </Text>
        <GradientButton
          type="submit"
          size="sm"
          isLoading={addComment.isPending}
          loadingText="Posting"
          isDisabled={isDisabled}
        >
          Post comment
        </GradientButton>
      </HStack>
    </chakra.form>
  );
}

export default CommentForm;

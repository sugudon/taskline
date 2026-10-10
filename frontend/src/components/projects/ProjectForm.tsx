import { useState, type FormEvent } from 'react';
import {
  Box,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Switch,
  Textarea,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';
import { AnimatedInput } from '../ui/AnimatedInput';
import { AnimatedButton } from '../ui/AnimatedButton';
import { GradientButton } from '../ui/GradientButton';
import { MotionButton, buttonHover, buttonTap } from '../ui/motion';
import { DEFAULT_PROJECT_COLOR, PROJECT_COLOR_PRESETS } from '../../lib/constants';

export interface ProjectFormValues {
  name: string;
  description: string;
  color: string;
  is_archived: boolean;
}

export interface ProjectFormProps {
  initialValues?: Partial<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Show the archive switch (edit mode). */
  showArchive?: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
  color?: string;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const validate = (v: ProjectFormValues): FormErrors => {
  const errors: FormErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length > 100) errors.name = 'Name must be 100 characters or fewer';
  if (!HEX_RE.test(v.color)) errors.color = 'Use a hex color like #805AD5';
  return errors;
};

export function ProjectForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isSubmitting = false,
  showArchive = false,
}: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    color: initialValues?.color ?? DEFAULT_PROJECT_COLOR,
    is_archived: initialValues?.is_archived ?? false,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const update = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    onSubmit({ ...values, name: values.name.trim(), description: values.description.trim() });
  };

  const isValidHex = HEX_RE.test(values.color);

  return (
    <Box as="form" onSubmit={handleSubmit} noValidate>
      <VStack spacing={5} align="stretch">
        <AnimatedInput
          label="Name"
          name="name"
          isRequired
          value={values.name}
          maxLength={100}
          placeholder="e.g. Thesis research"
          onChange={(e) => update('name', e.target.value)}
          error={errors.name}
        />

        <FormControl isInvalid={Boolean(errors.description)}>
          <FormLabel htmlFor="description" fontWeight="medium">
            Description
          </FormLabel>
          <Textarea
            id="description"
            name="description"
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What is this project about?"
            rows={4}
            borderRadius="xl"
            bg="bg.surface"
          />
          <FormErrorMessage>{errors.description}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={Boolean(errors.color)}>
          <FormLabel fontWeight="medium">Color</FormLabel>
          <Wrap spacing={3} mb={3}>
            {PROJECT_COLOR_PRESETS.map((preset) => {
              const selected = preset.toLowerCase() === values.color.toLowerCase();
              return (
                <WrapItem key={preset}>
                  <MotionButton
                    type="button"
                    aria-label={`Use color ${preset}`}
                    aria-pressed={selected}
                    onClick={() => update('color', preset)}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                    bg={preset}
                    _hover={{ bg: preset }}
                    _active={{ bg: preset }}
                    minW={9}
                    h={9}
                    p={0}
                    borderRadius="full"
                    borderWidth={selected ? '3px' : '1px'}
                    borderColor={selected ? 'white' : 'border.subtle'}
                    boxShadow={selected ? 'outline' : 'sm'}
                  >
                    {selected ? <CheckIcon color="white" boxSize={3} /> : null}
                  </MotionButton>
                </WrapItem>
              );
            })}
          </Wrap>
          <HStack align="end" spacing={3}>
            <Box
              w={10}
              h={10}
              flexShrink={0}
              borderRadius="lg"
              borderWidth="1px"
              borderColor="border.subtle"
              bg={isValidHex ? values.color : 'transparent'}
              aria-hidden
            />
            <AnimatedInput
              label="Hex"
              name="color"
              value={values.color}
              maxLength={7}
              onChange={(e) => update('color', e.target.value)}
              error={errors.color}
            />
          </HStack>
          {!errors.color ? <FormHelperText>Pick a preset or enter a custom hex color.</FormHelperText> : null}
        </FormControl>

        {showArchive ? (
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor="is_archived" mb={0} fontWeight="medium">
              Archived
            </FormLabel>
            <Switch
              id="is_archived"
              colorScheme="brand"
              isChecked={values.is_archived}
              onChange={(e) => update('is_archived', e.target.checked)}
            />
          </FormControl>
        ) : null}

        <HStack justify="flex-end" spacing={3} pt={2}>
          {onCancel ? (
            <AnimatedButton variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
              Cancel
            </AnimatedButton>
          ) : null}
          <GradientButton type="submit" isLoading={isSubmitting}>
            {submitLabel}
          </GradientButton>
        </HStack>
      </VStack>
    </Box>
  );
}

export default ProjectForm;

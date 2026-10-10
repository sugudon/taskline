import { forwardRef, type ReactNode } from 'react';
import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  type InputProps,
} from '@chakra-ui/react';
import { MotionBox } from './motion';

export interface AnimatedInputProps extends InputProps {
  label: string;
  error?: string;
  helperText?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

export const AnimatedInput = forwardRef<HTMLInputElement, AnimatedInputProps>(
  function AnimatedInput(
    { label, error, helperText, leftElement, rightElement, isRequired, isDisabled, id, name, ...rest },
    ref,
  ) {
    const inputId = id ?? name;
    return (
      <FormControl isInvalid={Boolean(error)} isRequired={isRequired} isDisabled={isDisabled}>
        <FormLabel htmlFor={inputId} fontWeight="medium">
          {label}
        </FormLabel>
        <MotionBox
          whileFocus={{ scale: 1.01 }}
          whileHover={{ scale: 1.005 }}
          transition={{ duration: 0.15 }}
        >
          <InputGroup>
            {leftElement ? <InputLeftElement>{leftElement}</InputLeftElement> : null}
            <Input
              ref={ref}
              id={inputId}
              name={name}
              borderRadius="xl"
              bg="bg.surface"
              _focusVisible={{ borderColor: 'brand.400', boxShadow: '0 0 0 3px rgba(128, 90, 213, 0.25)' }}
              {...rest}
            />
            {rightElement ? <InputRightElement>{rightElement}</InputRightElement> : null}
          </InputGroup>
        </MotionBox>
        {error ? (
          <FormErrorMessage>{error}</FormErrorMessage>
        ) : helperText ? (
          <FormHelperText>{helperText}</FormHelperText>
        ) : null}
      </FormControl>
    );
  },
);

export default AnimatedInput;

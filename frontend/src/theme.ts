import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', system-ui, -apple-system, sans-serif`,
    body: `'Inter', system-ui, -apple-system, sans-serif`,
  },
  colors: {
    brand: {
      50: '#f5f0ff',
      100: '#e9dcff',
      200: '#d3b9ff',
      300: '#b98cfc',
      400: '#9f5ef5',
      500: '#805ad5',
      600: '#6b46c1',
      700: '#553c9a',
      800: '#44337a',
      900: '#322659',
    },
    accent: {
      50: '#fff0f7',
      100: '#fed7e2',
      200: '#fbb6ce',
      300: '#f687b3',
      400: '#ed64a6',
      500: '#d53f8c',
      600: '#b83280',
      700: '#97266d',
      800: '#702459',
      900: '#521b41',
    },
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: 'gray.50', _dark: 'gray.900' },
      'bg.surface': { default: 'whiteAlpha.800', _dark: 'whiteAlpha.100' },
      'border.subtle': { default: 'blackAlpha.100', _dark: 'whiteAlpha.200' },
      'text.muted': { default: 'gray.600', _dark: 'gray.400' },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'bg.canvas',
        color: 'gray.800',
        _dark: { color: 'gray.100' },
      },
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'brand' },
      baseStyle: { borderRadius: 'xl', fontWeight: 'semibold' },
    },
    Input: { defaultProps: { focusBorderColor: 'brand.400' } },
    Textarea: { defaultProps: { focusBorderColor: 'brand.400' } },
    Select: { defaultProps: { focusBorderColor: 'brand.400' } },
    Badge: { baseStyle: { borderRadius: 'full', px: 2, textTransform: 'none' } },
  },
  layerStyles: {
    brandGradient: { bgGradient: 'linear(to-r, brand.500, accent.500)', color: 'white' },
  },
});

export default theme;

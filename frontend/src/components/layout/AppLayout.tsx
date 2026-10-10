import { Suspense, type ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
  Avatar,
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import {
  AtSignIcon,
  AttachmentIcon,
  CheckCircleIcon,
  HamburgerIcon,
  SettingsIcon,
  StarIcon,
  UnlockIcon,
} from '@chakra-ui/icons';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { LoadingState } from '../ui/LoadingState';
import { MotionBox, MotionButton, MotionIconButton, buttonHover, buttonTap } from '../ui/motion';

interface NavItem {
  label: string;
  to: string;
  icon: ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <StarIcon /> },
  { label: 'Projects', to: '/projects', icon: <AttachmentIcon /> },
  { label: 'Assignments', to: '/assignments', icon: <CheckCircleIcon /> },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon /> },
  { label: 'Profile', to: '/profile', icon: <AtSignIcon /> },
];

const SIDEBAR_WIDTH = '240px';

interface NavListProps {
  onNavigate?: () => void;
  onLogout: () => void;
}

function NavList({ onNavigate, onLogout }: NavListProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <VStack as="nav" align="stretch" spacing={1} aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <MotionButton
            key={item.to}
            onClick={() => {
              navigate(item.to);
              onNavigate?.();
            }}
            whileHover={{ x: 4 }}
            whileTap={buttonTap}
            justifyContent="flex-start"
            leftIcon={item.icon}
            variant={active ? 'solid' : 'ghost'}
            colorScheme={active ? 'brand' : 'gray'}
            borderRadius="xl"
            fontWeight={active ? 'semibold' : 'medium'}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </MotionButton>
        );
      })}
      <MotionButton
        onClick={onLogout}
        whileHover={{ x: 4 }}
        whileTap={buttonTap}
        justifyContent="flex-start"
        leftIcon={<UnlockIcon />}
        variant="ghost"
        colorScheme="red"
        borderRadius="xl"
        mt={4}
      >
        Logout
      </MotionButton>
    </VStack>
  );
}

function Brand() {
  return (
    <Text
      fontSize="xl"
      fontWeight="extrabold"
      bgGradient="linear(to-r, brand.500, accent.500)"
      bgClip="text"
      letterSpacing="tight"
    >
      Taskline
    </Text>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const drawer = useDisclosure();

  const handleLogout = async (): Promise<void> => {
    drawer.onClose();
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.full_name ?? user?.email ?? '';

  return (
    <Flex minH="100vh" bg="bg.canvas">
      {/* Desktop sidebar */}
      <Box
        as="aside"
        display={{ base: 'none', md: 'block' }}
        w={SIDEBAR_WIDTH}
        flexShrink={0}
        position="fixed"
        insetY={0}
        left={0}
        p={5}
        bg="bg.surface"
        backdropFilter="blur(16px)"
        borderRightWidth="1px"
        borderColor="border.subtle"
      >
        <Box mb={8}>
          <Brand />
        </Box>
        <NavList onLogout={() => void handleLogout()} />
      </Box>

      {/* Mobile drawer */}
      <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerBody pt={12}>
            <Box mb={6}>
              <Brand />
            </Box>
            <NavList onNavigate={drawer.onClose} onLogout={() => void handleLogout()} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Flex direction="column" flex={1} ml={{ base: 0, md: SIDEBAR_WIDTH }} minW={0}>
        {/* Top bar */}
        <Flex
          as="header"
          position="sticky"
          top={0}
          zIndex="sticky"
          h={16}
          px={{ base: 4, md: 8 }}
          align="center"
          justify="space-between"
          bg="bg.surface"
          backdropFilter="blur(16px)"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <HStack spacing={3}>
            <MotionIconButton
              display={{ base: 'inline-flex', md: 'none' }}
              aria-label="Open navigation"
              icon={<HamburgerIcon />}
              variant="ghost"
              onClick={drawer.onOpen}
              whileHover={buttonHover}
              whileTap={buttonTap}
            />
            <Box display={{ base: 'block', md: 'none' }}>
              <Brand />
            </Box>
          </HStack>

          <Menu placement="bottom-end">
            <MenuButton
              as={MotionButton}
              variant="ghost"
              colorScheme="gray"
              borderRadius="full"
              px={2}
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              <HStack spacing={2}>
                <Avatar size="sm" name={displayName} src={user?.avatar_url ?? undefined} />
                <Text display={{ base: 'none', sm: 'block' }} fontSize="sm" fontWeight="medium" noOfLines={1} maxW="180px">
                  {displayName}
                </Text>
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem icon={<AtSignIcon />} onClick={() => navigate('/profile')}>
                Profile
              </MenuItem>
              <MenuItem icon={<SettingsIcon />} onClick={() => navigate('/settings')}>
                Settings
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<UnlockIcon />} color="red.500" onClick={() => void handleLogout()}>
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>

        <Box as="main" flex={1} px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }} maxW="7xl" w="full" mx="auto">
          <AnimatePresence mode="wait">
            <MotionBox key={location.pathname}>
              {/* Pages are lazy-loaded; keep the shell visible while a chunk downloads. */}
              <Suspense fallback={<LoadingState label="Loading page..." />}>
                <Outlet />
              </Suspense>
            </MotionBox>
          </AnimatePresence>
        </Box>
      </Flex>
    </Flex>
  );
}

export default AppLayout;

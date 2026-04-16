'use client'

import { usePathname } from 'next/navigation'
import {
  Badge,
  Box,
  HStack,
  Spacer,
  Text,
} from '@chakra-ui/react'
import { Link } from '@chakra-ui/next-js'
import {
  AppShell,
  Navbar,
  NavbarBrand,
  NavItem,
  Sidebar,
  SidebarSection,
} from '@saas-ui/react'
import LogoutButton from '@/components/LogoutButton'
import type { Profile } from '@/types'

function pathMatchesSimulations(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/simulations')
}

function pathMatchesHref(pathname: string, href: string) {
  if (href === '/dashboard') return pathMatchesSimulations(pathname)
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarNavItem({
  href,
  pathname,
  children: label,
}: {
  href: string
  pathname: string
  children: React.ReactNode
}) {
  const active = pathMatchesHref(pathname, href)
  return (
    <NavItem
      href={href}
      isActive={active}
      borderRadius="md"
      px={3}
      py={2}
      mb={0.5}
      transition="background 0.15s ease, color 0.15s ease, border-color 0.15s ease"
      bg={active ? 'cyan.50' : 'transparent'}
      color={active ? 'cyan.800' : 'gray.700'}
      fontWeight={active ? 'semibold' : 'medium'}
      borderLeftWidth="3px"
      borderLeftColor={active ? 'cyan.500' : 'transparent'}
      _hover={{
        bg: active ? 'cyan.100' : 'gray.100',
        color: active ? 'cyan.900' : 'gray.900',
      }}
      _focusVisible={{
        boxShadow: 'outline',
        outline: 'none',
      }}
    >
      {label}
    </NavItem>
  )
}

export default function DashboardShell({
  children,
  profile,
  showAnalyticsLink,
}: {
  children: React.ReactNode
  profile: Profile | null
  showAnalyticsLink: boolean
}) {
  const pathname = usePathname()
  const isCallRoute = pathname.startsWith('/dashboard/sessions/call')

  return (
    <AppShell
      variant="static"
      minH="100vh"
      navbar={
        <Navbar borderBottomWidth="1px" position="sticky" top={0} zIndex="sticky">
          <NavbarBrand>
            <Link href="/dashboard" fontWeight="bold" fontSize="md">
              RepReady
            </Link>
          </NavbarBrand>
          <Spacer />
          {profile && (
            <HStack spacing={3} display={{ base: 'none', md: 'flex' }}>
              <Text fontSize="xs" color="gray.500">
                {profile.email}
              </Text>
              <Badge textTransform="capitalize" colorScheme="gray" variant="subtle">
                {profile.role}
              </Badge>
            </HStack>
          )}
          <LogoutButton />
        </Navbar>
      }
      sidebar={
        <Sidebar position="sticky" top="56px" toggleBreakpoint="md" height="calc(100vh - 56px)">
          <SidebarSection>
            <SidebarNavItem href="/dashboard" pathname={pathname}>
              Simulations
            </SidebarNavItem>
            <SidebarNavItem href="/dashboard/sessions" pathname={pathname}>
              History
            </SidebarNavItem>
            {profile?.role !== 'rep' && (
              <>
                <SidebarNavItem href="/dashboard/progress" pathname={pathname}>
                  Progress
                </SidebarNavItem>
              </>
            )}
            {showAnalyticsLink && (
              <SidebarNavItem href="/dashboard/analytics" pathname={pathname}>
                Analytics
              </SidebarNavItem>
            )}
          </SidebarSection>
        </Sidebar>
      }
    >
      <Box
        as="main"
        flex="1"
        py={isCallRoute ? 0 : 8}
        px={isCallRoute ? 0 : { base: 4, md: 6 }}
        maxW="none"
        mx={0}
        w="full"
        overflowY="auto"
        bg="white"
        minH={isCallRoute ? 'calc(100vh - 56px)' : '100vh'}
      >
        {children}
      </Box>
    </AppShell>
  )
}

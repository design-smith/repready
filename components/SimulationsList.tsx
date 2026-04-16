'use client'

import { useState, useMemo } from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Text,
  VStack,
  Icon,
  Badge,
} from '@chakra-ui/react'
import { Link } from '@chakra-ui/next-js'
import { SearchIcon } from '@saas-ui/react'
import DifficultyBadge from '@/components/DifficultyBadge'
import DashboardPageHero from '@/components/DashboardPageHero'
import type { Simulation, Role } from '@/types'

interface SimulationsListProps {
  simulations: Pick<
    Simulation,
    'id' | 'title' | 'difficulty' | 'call_goal' | 'persona_name' | 'is_active' | 'version' | 'created_at'
  >[]
  userRole: Role
}

export default function SimulationsList({ simulations, userRole }: SimulationsListProps) {
  const [search, setSearch] = useState('')

  const canCreate = userRole === 'trainer' || userRole === 'admin'
  const showMetaBadges = userRole !== 'rep'

  const filtered = useMemo(() => {
    return simulations.filter((s) => {
      const matchesSearch =
        !search.trim() ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.persona_name.toLowerCase().includes(search.toLowerCase())
      return matchesSearch
    })
  }, [simulations, search])

  return (
    <Box>
      <DashboardPageHero
        kicker="Practice floor"
        title="Simulations"
        description={
          canCreate
            ? 'Design scenarios, tune personas, and ship realistic call practice for your team. Reps see only what you mark active.'
            : 'Pick a scenario, dial in, and get scored like a real buyer conversation. Each run builds muscle memory for discovery, objections, and close.'
        }
      />
      <HStack justify="space-between" align="flex-start" mb={6} flexDir={{ base: 'column', sm: 'row' }} gap={4}>
        <Box>
          <Heading size="md" color="gray.800">
            Library
          </Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            {simulations.length} simulation{simulations.length !== 1 ? 's' : ''} available
          </Text>
        </Box>
        {canCreate && (
          <Button as={Link} href="/dashboard/simulations/new" colorScheme="blue" leftIcon={<Icon viewBox="0 0 20 20" boxSize={4}><path fill="currentColor" d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></Icon>}>
            New Simulation
          </Button>
        )}
      </HStack>

      <HStack mb={6} flexDir={{ base: 'column', sm: 'row' }} gap={3} align={{ base: 'stretch', sm: 'center' }}>
        <InputGroup flex={1}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon />
          </InputLeftElement>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or persona…"
            pl={10}
          />
        </InputGroup>
      </HStack>

      {filtered.length === 0 ? (
        <VStack py={16} color="gray.400" spacing={2}>
          <Text fontSize="lg" fontWeight="medium">
            No simulations found
          </Text>
          <Text fontSize="sm" textAlign="center">
            {simulations.length === 0
              ? canCreate
                ? 'Create your first simulation to get started.'
                : 'No simulations are available yet.'
              : 'Try adjusting your search.'}
          </Text>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/simulations/${s.id}`}
              _hover={{ textDecoration: 'none' }}
            >
              <Box
                borderWidth="1px"
                borderRadius="xl"
                p={5}
                bg="white"
                boxShadow="sm"
                h="full"
                transition="box-shadow 0.15s, border-color 0.15s"
                _hover={{ boxShadow: 'md', borderColor: 'gray.300' }}
              >
                <HStack justify="space-between" align="flex-start" mb={3} spacing={2}>
                  <Text fontWeight="semibold" fontSize="sm" noOfLines={2} color="gray.800">
                    {s.title}
                  </Text>
                  {showMetaBadges && <DifficultyBadge difficulty={s.difficulty} />}
                </HStack>

                <Text fontSize="xs" color="gray.600" fontWeight="medium" mb={1}>
                  {s.persona_name}
                </Text>

                <Text fontSize="xs" color="gray.500" noOfLines={2} mb={3}>
                  {s.call_goal}
                </Text>

                <HStack justify="space-between" fontSize="xs" color="gray.400">
                  {showMetaBadges ? (
                    <Badge
                      colorScheme={s.is_active ? 'green' : 'gray'}
                      variant="subtle"
                      display="inline-flex"
                      alignItems="center"
                      gap={1}
                    >
                      <Box as="span" w={1.5} h={1.5} borderRadius="full" bg={s.is_active ? 'green.400' : 'gray.400'} />
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  ) : (
                    <Box />
                  )}
                  <Text>v{s.version}</Text>
                </HStack>
              </Box>
            </Link>
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}

'use client'

import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { Link } from '@chakra-ui/next-js'
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@saas-ui/react'
import DifficultyBadge from '@/components/DifficultyBadge'
import type { Profile, SessionStatus, Difficulty } from '@/types'

export interface SessionRowView {
  id: string
  status: SessionStatus
  started_at: string | null
  ended_at: string | null
  created_at: string
  simulations: {
    title: string
    difficulty: Difficulty
  } | null
  evaluations: {
    overall_score: number
    passed: boolean
  } | null
}

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const s = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const map: Record<SessionStatus, { label: string; scheme: string }> = {
    pending: { label: 'Pending', scheme: 'gray' },
    active: { label: 'In progress', scheme: 'blue' },
    ended: { label: 'Ended', scheme: 'gray' },
    evaluated: { label: 'Evaluated', scheme: 'green' },
  }
  const m = map[status]
  return (
    <Badge colorScheme={m.scheme} variant="subtle" borderRadius="full" px={2}>
      {m.label}
    </Badge>
  )
}

export default function SessionsView({
  sessions,
  profileRole,
}: {
  sessions: SessionRowView[]
  profileRole: Profile['role'] | undefined
}) {
  return (
    <Box w="full">
      <Box
        borderRadius="2xl"
        bgGradient="linear(135deg, gray.800 0%, cyan.700 100%)"
        color="white"
        px={{ base: 6, md: 8 }}
        py={{ base: 6, md: 8 }}
        mb={8}
        boxShadow="lg"
      >
        <Text fontSize="sm" fontWeight="semibold" color="cyan.100" textTransform="uppercase" letterSpacing="wider" mb={2}>
          Call history
        </Text>
        <Heading size="lg" mb={2}>
          History
        </Heading>
        <Text color="whiteAlpha.900" fontSize="md">
          Every practice run, score, and outcome in one place. Open results to see coaching and transcripts.
        </Text>
      </Box>

      {sessions.length === 0 ? (
        <Box borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={10} bg="white" boxShadow="sm">
          <EmptyState>
            <EmptyStateTitle>No history yet</EmptyStateTitle>
            <EmptyStateDescription>
              {profileRole === 'rep'
                ? 'Pick a simulation and start your first practice call.'
                : 'Reps have not completed any sessions.'}
            </EmptyStateDescription>
            {profileRole === 'rep' && (
              <Button as={Link} href="/dashboard" colorScheme="cyan" mt={4}>
                Browse simulations
              </Button>
            )}
          </EmptyState>
        </Box>
      ) : (
        <TableContainer
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="2xl"
          overflow="hidden"
          boxShadow="sm"
          bg="white"
        >
          <Table size="sm">
            <Thead bg="gray.50">
              <Tr>
                <Th textTransform="uppercase" fontSize="xs" color="gray.500" borderBottomColor="gray.200">
                  Simulation
                </Th>
                <Th textTransform="uppercase" fontSize="xs" color="gray.500" borderBottomColor="gray.200">
                  Date
                </Th>
                <Th textTransform="uppercase" fontSize="xs" color="gray.500" borderBottomColor="gray.200">
                  Duration
                </Th>
                <Th textTransform="uppercase" fontSize="xs" color="gray.500" borderBottomColor="gray.200">
                  Score
                </Th>
                <Th textTransform="uppercase" fontSize="xs" color="gray.500" borderBottomColor="gray.200">
                  Status
                </Th>
                <Th borderBottomColor="gray.200" />
              </Tr>
            </Thead>
            <Tbody>
              {sessions.map((session) => {
                const ev = Array.isArray(session.evaluations)
                  ? (session.evaluations as { overall_score: number; passed: boolean }[])[0] ?? null
                  : session.evaluations

                return (
                  <Tr key={session.id} _hover={{ bg: 'cyan.50' }} transition="background 0.15s">
                    <Td borderColor="gray.100" verticalAlign="middle">
                      <HStack spacing={2} flexWrap="wrap">
                        <Text fontWeight="semibold" color="gray.800">
                          {session.simulations?.title ?? 'Unknown simulation'}
                        </Text>
                        {session.simulations?.difficulty && (
                          <DifficultyBadge difficulty={session.simulations.difficulty} />
                        )}
                      </HStack>
                    </Td>
                    <Td borderColor="gray.100" color="gray.600">
                      {new Date(session.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Td>
                    <Td borderColor="gray.100" color="gray.600">
                      {session.status === 'active'
                        ? 'In progress'
                        : formatDuration(session.started_at, session.ended_at)}
                    </Td>
                    <Td borderColor="gray.100" verticalAlign="middle">
                      {ev ? (
                        <HStack spacing={2}>
                          <Text fontWeight="bold" color="gray.900">
                            {ev.overall_score}
                          </Text>
                          <Badge colorScheme={ev.passed ? 'green' : 'red'} variant="solid" borderRadius="md">
                            {ev.passed ? 'Pass' : 'Fail'}
                          </Badge>
                        </HStack>
                      ) : (
                        <Text color="gray.400">—</Text>
                      )}
                    </Td>
                    <Td borderColor="gray.100">
                      <StatusBadge status={session.status} />
                    </Td>
                    <Td borderColor="gray.100" textAlign="right">
                      {(session.status === 'ended' || session.status === 'evaluated') && (
                        <Button
                          as={Link}
                          href={`/dashboard/sessions/${session.id}/results`}
                          size="sm"
                          variant="ghost"
                          colorScheme="cyan"
                        >
                          Results →
                        </Button>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

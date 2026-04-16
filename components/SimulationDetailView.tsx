'use client'

import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Icon,
  List,
  ListIcon,
  ListItem,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { Link } from '@chakra-ui/next-js'
import { CheckIcon } from '@saas-ui/react'

function WarningTriIcon(props: React.ComponentProps<typeof Icon>) {
  return (
    <Icon viewBox="0 0 20 20" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </Icon>
  )
}
import DifficultyBadge from '@/components/DifficultyBadge'
import VersionHistory from '@/components/VersionHistory'
import StartCallButton from '@/components/StartCallButton'
import { BackLink } from '@/components/page-ui/BackLink'
import { PERSONA_VOICE_OPTIONS } from '@/lib/voices'
import type { Role, SimulationWithVersions } from '@/types'

function SectionShell({
  title,
  kicker,
  emoji,
  accent = 'brand',
  children,
}: {
  title: string
  kicker?: string
  emoji?: string
  accent?: 'brand' | 'purple' | 'orange'
  children: React.ReactNode
}) {
  const border =
    accent === 'purple' ? 'purple.200' : accent === 'orange' ? 'orange.200' : 'cyan.200'
  const bg =
    accent === 'purple'
      ? 'linear(to-br, white, purple.50)'
      : accent === 'orange'
        ? 'linear(to-br, white, orange.50)'
        : 'linear(to-br, white, cyan.50)'

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="2xl"
      overflow="hidden"
      boxShadow="sm"
      bgGradient={bg}
    >
      <Flex
        align="center"
        gap={3}
        px={6}
        py={4}
        borderBottomWidth="1px"
        borderColor={border}
        bg="whiteAlpha.800"
      >
        {emoji && (
          <Text fontSize="2xl" lineHeight={1} aria-hidden>
            {emoji}
          </Text>
        )}
        <Box>
          {kicker && (
            <Text fontSize="xs" fontWeight="semibold" color={`${accent === 'brand' ? 'cyan' : accent}.600`} textTransform="uppercase" letterSpacing="wider">
              {kicker}
            </Text>
          )}
          <Heading size="sm" color="gray.800">
            {title}
          </Heading>
        </Box>
      </Flex>
      <Box px={6} py={5}>
        {children}
      </Box>
    </Box>
  )
}

function DetailField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wide" mb={1}>
        {label}
      </Text>
      <Text fontSize="sm" color="gray.800" whiteSpace={multiline ? 'pre-wrap' : 'normal'} lineHeight="tall">
        {value}
      </Text>
    </Box>
  )
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wide" mb={2}>
        {label}
      </Text>
      {items.length === 0 ? (
        <Text fontSize="sm" color="gray.400" fontStyle="italic">
          None defined
        </Text>
      ) : (
        <List spacing={2}>
          {items.map((item, i) => (
            <ListItem key={i} display="flex" gap={2} fontSize="sm" color="gray.700">
              <ListIcon as={CheckIcon} color="cyan.500" mt={0.5} />
              {item}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  )
}

export default function SimulationDetailView({
  simulation,
  profileRole,
  canEdit,
}: {
  simulation: SimulationWithVersions
  profileRole: Role | undefined
  canEdit: boolean
}) {
  const showStart = profileRole === 'rep' && simulation.is_active
  const showMetaBadges = profileRole !== 'rep'
  const showAuthoringSections = profileRole !== 'rep'
  const voiceLabel =
    PERSONA_VOICE_OPTIONS.find((voice) => voice.id === simulation.persona_voice)?.label ??
    simulation.persona_voice

  return (
    <Box w="full">
      <BackLink href="/dashboard">Back to simulations</BackLink>

      {/* Hero */}
      <Box
        position="relative"
        borderRadius="2xl"
        overflow="hidden"
        mb={8}
        bgGradient="linear(135deg, gray.900 0%, cyan.800 45%, teal.700 100%)"
        color="white"
        px={{ base: 6, md: 10 }}
        py={{ base: 8, md: 10 }}
        boxShadow="xl"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.08}
          bgImage="radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 80%, white 0%, transparent 40%)"
        />
        <Stack position="relative" spacing={4}>
          <HStack flexWrap="wrap" gap={2}>
            {showMetaBadges && (
              <Box bg="whiteAlpha.300" borderRadius="full" px={1} py={0.5}>
                <DifficultyBadge difficulty={simulation.difficulty} />
              </Box>
            )}
            {showMetaBadges && (
              <Badge
                colorScheme={simulation.is_active ? 'green' : 'gray'}
                variant="solid"
                borderRadius="full"
                px={3}
                py={0.5}
              >
                {simulation.is_active ? 'Live for reps' : 'Draft / inactive'}
              </Badge>
            )}
            <Badge variant="outline" colorScheme="whiteAlpha" borderColor="whiteAlpha.400" color="white">
              v{simulation.version}
            </Badge>
          </HStack>
          <Heading size="xl" fontWeight="bold" letterSpacing="tight" lineHeight="shorter">
            {simulation.title}
          </Heading>
          <Text color="whiteAlpha.900" fontSize="md" lineHeight="tall">
            {simulation.call_goal}
          </Text>
          <HStack flexWrap="wrap" spacing={4} pt={2}>
            <Text fontSize="sm" color="whiteAlpha.700">
              Created{' '}
              {new Date(simulation.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <Divider orientation="vertical" h={4} borderColor="whiteAlpha.400" />
            <Text fontSize="sm" color="whiteAlpha.700">
              Persona: <strong>{simulation.persona_name}</strong>, {simulation.persona_role}
            </Text>
          </HStack>
          <HStack spacing={3} pt={2} flexWrap="wrap">
            {showStart && <StartCallButton simulationId={simulation.id} />}
            {canEdit && (
              <Button
                as={Link}
                href={`/dashboard/simulations/${simulation.id}/edit`}
                size="md"
                bg="white"
                color="gray.900"
                _hover={{ bg: 'gray.100' }}
                boxShadow="md"
              >
                Edit scenario
              </Button>
            )}
          </HStack>
        </Stack>
      </Box>

      <VStack spacing={6} align="stretch">
        <SectionShell title="Persona depth" kicker="Who you are calling" accent="purple">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <DetailField label="Name" value={simulation.persona_name} />
            <DetailField label="Role / title" value={simulation.persona_role} />
            {showAuthoringSections && <DetailField label="Voice" value={voiceLabel} />}
          </SimpleGrid>
          <Box mt={6}>
            <DetailField label="Company context" value={simulation.company_context} multiline />
          </Box>
          {showAuthoringSections && (
            <Box mt={6}>
              <DetailField label="Communication style" value={simulation.persona_style} />
            </Box>
          )}
        </SectionShell>

        {showAuthoringSections && (
          <SectionShell title="Opening beat" kicker="First impression" accent="brand">
            <Box borderLeftWidth="4px" borderColor="cyan.400" pl={4} py={3} borderRadius="md" bg="cyan.50">
              <Text fontSize="sm" fontStyle="italic" color="gray.700" lineHeight="tall">
                &ldquo;{simulation.opening_line}&rdquo;
              </Text>
            </Box>
          </SectionShell>
        )}

        {showAuthoringSections && (
          <SectionShell title="Knowledge boundaries" kicker="Ground rules for the AI" accent="orange">
            <Stack spacing={8}>
              <ListField label="Hidden objections" items={simulation.hidden_objections} />
              <ListField label="Allowed disclosures" items={simulation.allowed_disclosures} />
              <Box>
                <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wide" mb={2}>
                  Forbidden disclosures
                </Text>
                {simulation.forbidden_disclosures.length === 0 ? (
                  <Text fontSize="sm" color="gray.400" fontStyle="italic">
                    None defined
                  </Text>
                ) : (
                  <List spacing={2}>
                    {simulation.forbidden_disclosures.map((item, i) => (
                      <ListItem key={i} display="flex" gap={2} fontSize="sm" color="gray.700" alignItems="flex-start">
                        <WarningTriIcon color="orange.500" mt={0.5} boxSize={4} shrink={0} />
                        {item}
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Stack>
          </SectionShell>
        )}

        {showAuthoringSections && (
          <SectionShell title="Scoring rubric" kicker="How you will be graded" accent="brand">
            <DetailField label="Success criteria" value={simulation.success_criteria} multiline />
            <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wide" mt={8} mb={3}>
              Category weights
            </Text>
            <VStack align="stretch" spacing={3}>
              {simulation.scoring_rubric.map((category, i) => (
                <Box
                  key={i}
                  p={4}
                  borderRadius="xl"
                  bg="white"
                  borderWidth="1px"
                  borderColor="gray.100"
                  boxShadow="xs"
                >
                  <Flex justify="space-between" align="flex-start" gap={4} mb={2} flexWrap="wrap">
                    <Text fontWeight="semibold" color="gray.800">
                      {category.name}
                    </Text>
                    <HStack>
                      <Progress
                        value={(category.weight / 10) * 100}
                        size="sm"
                        colorScheme="cyan"
                        borderRadius="full"
                        w="100px"
                      />
                      <Text fontSize="xs" color="gray.500" w="12" textAlign="right">
                        {category.weight}/10
                      </Text>
                    </HStack>
                  </Flex>
                  {category.description && (
                    <Text fontSize="xs" color="gray.500">
                      {category.description}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          </SectionShell>
        )}

        {canEdit && simulation.simulation_versions.length > 0 && (
          <VersionHistory versions={simulation.simulation_versions} />
        )}
      </VStack>
    </Box>
  )
}

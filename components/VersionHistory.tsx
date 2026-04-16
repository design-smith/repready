'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Collapse,
  Flex,
  Heading,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { SimulationVersion } from '@/types'

export default function VersionHistory({
  versions,
}: {
  versions: SimulationVersion[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="2xl"
      overflow="hidden"
      boxShadow="sm"
      bgGradient="linear(to-br, white, gray.50)"
    >
      <Button
        variant="unstyled"
        w="full"
        px={6}
        py={4}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen((v) => !v)}
        _hover={{ bg: 'blackAlpha.50' }}
      >
        <Heading size="sm" color="gray.800">
          Version history{' '}
          <Text as="span" fontWeight="normal" color="gray.500" fontSize="sm">
            ({versions.length} snapshot{versions.length !== 1 ? 's' : ''})
          </Text>
        </Heading>
        <Icon
          viewBox="0 0 20 20"
          boxSize={5}
          color="gray.400"
          transform={open ? 'rotate(180deg)' : undefined}
          transition="transform 0.2s"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </Icon>
      </Button>

      <Collapse in={open} animateOpacity>
        <Box px={6} pb={5} pt={0}>
          <VStack align="stretch" spacing={3}>
            {versions.map((v) => (
              <Flex
                key={v.id}
                direction={{ base: 'column', sm: 'row' }}
                justify="space-between"
                gap={2}
                p={4}
                borderRadius="xl"
                bg="white"
                borderWidth="1px"
                borderColor="gray.100"
                boxShadow="xs"
              >
                <Box>
                  <Text fontWeight="semibold" color="gray.800">
                    Version {v.version}
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt={1} noOfLines={1}>
                    {(v.snapshot as { title?: string }).title ?? '—'}
                  </Text>
                </Box>
                <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">
                  {new Date(v.created_at).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Flex>
            ))}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  )
}

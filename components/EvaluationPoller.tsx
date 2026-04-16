'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import type { Evaluation } from '@/types'

interface EvaluationPollerProps {
  sessionId: string
  onEvaluationReady: (evaluation: Evaluation) => void
}

export default function EvaluationPoller({
  sessionId,
  onEvaluationReady,
}: EvaluationPollerProps) {
  const [timedOut, setTimedOut] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    const poll = async () => {
      if (resolvedRef.current) return
      try {
        const res = await fetch(`/api/sessions/${sessionId}/evaluation`)
        if (!res.ok) return
        const data = await res.json()
        if (data.evaluation) {
          resolvedRef.current = true
          clearInterval(intervalRef.current!)
          clearTimeout(timeoutRef.current!)
          onEvaluationReady(data.evaluation as Evaluation)
        }
      } catch {
        // Network hiccup — keep polling
      }
    }

    intervalRef.current = setInterval(poll, 3000)
    poll()

    timeoutRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        clearInterval(intervalRef.current!)
        setTimedOut(true)
      }
    }, 60000)

    return () => {
      clearInterval(intervalRef.current!)
      clearTimeout(timeoutRef.current!)
    }
  }, [sessionId, onEvaluationReady])

  if (timedOut) {
    return (
      <Box borderWidth="1px" borderColor="gray.200" borderRadius="2xl" p={10} bg="white" textAlign="center" boxShadow="sm">
        <Text color="gray.600" fontSize="sm">
          Scoring is taking longer than expected.{' '}
          <Button variant="link" colorScheme="cyan" size="sm" onClick={() => window.location.reload()}>
            Refresh the page
          </Button>{' '}
          to check again.
        </Text>
      </Box>
    )
  }

  return (
    <Box
      borderWidth="1px"
      borderColor="cyan.100"
      borderRadius="2xl"
      py={12}
      px={6}
      bgGradient="linear(to-br, white, cyan.50)"
      boxShadow="sm"
    >
      <VStack spacing={4}>
        <Spinner size="lg" color="cyan.500" thickness="4px" speed="0.7s" />
        <Stack spacing={1} textAlign="center">
          <Text fontWeight="semibold" color="gray.800">
            Analyzing your call
          </Text>
          <Text fontSize="sm" color="gray.500">
            Rubric scoring and coaching notes are on the way…
          </Text>
        </Stack>
      </VStack>
    </Box>
  )
}

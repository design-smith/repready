'use client'

import { Badge } from '@chakra-ui/react'
import type { Difficulty } from '@/types'

const scheme: Record<Difficulty, string> = {
  easy: 'green',
  medium: 'yellow',
  hard: 'red',
}

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge colorScheme={scheme[difficulty]} variant="subtle" textTransform="capitalize">
      {difficulty}
    </Badge>
  )
}

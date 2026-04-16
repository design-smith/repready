'use client'

import { Box, Heading, Text } from '@chakra-ui/react'

export default function DashboardPageHero({
  kicker,
  title,
  description,
}: {
  kicker: string
  title: string
  description: string
}) {
  return (
    <Box
      borderRadius="2xl"
      bgGradient="linear(135deg, gray.800 0%, cyan.700 55%, teal.600 100%)"
      color="white"
      px={{ base: 6, md: 8 }}
      py={{ base: 6, md: 8 }}
      mb={8}
      boxShadow="lg"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.12}
        bgImage="radial-gradient(circle at 10% 20%, white 0%, transparent 50%), radial-gradient(circle at 90% 80%, white 0%, transparent 45%)"
        pointerEvents="none"
      />
      <Box position="relative">
        <Text
          fontSize="sm"
          fontWeight="semibold"
          color="cyan.100"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={2}
        >
          {kicker}
        </Text>
        <Heading size="lg" mb={2}>
          {title}
        </Heading>
        <Text color="whiteAlpha.900" fontSize="md" lineHeight="tall">
          {description}
        </Text>
      </Box>
    </Box>
  )
}

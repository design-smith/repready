'use client'

import { Text } from '@chakra-ui/react'
import { Link } from '@chakra-ui/next-js'

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      display="inline-flex"
      alignItems="center"
      gap={2}
      fontSize="sm"
      fontWeight="medium"
      color="gray.600"
      mb={2}
      _hover={{ color: 'brand.600', textDecoration: 'none' }}
    >
      <Text as="span" aria-hidden>
        ←
      </Text>
      {children}
    </Link>
  )
}

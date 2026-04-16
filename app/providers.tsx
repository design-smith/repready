'use client'

import React from 'react'
import Link, { type LinkProps } from 'next/link'
import { extendTheme } from '@chakra-ui/react'
import { CacheProvider } from '@chakra-ui/next-js'
import { SaasProvider } from '@saas-ui/react'
import { theme as saasTheme } from '@saas-ui/theme'

const NextLink = React.forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => (
  <Link ref={ref} {...props} />
))
NextLink.displayName = 'NextLink'

const appTheme = extendTheme(saasTheme, {
  fonts: {
    heading: 'var(--font-inter), system-ui, sans-serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  colors: {
    brand: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
    },
  },
  semanticTokens: {
    colors: {
      'chakra-body-text': { default: 'gray.800' },
      'chakra-body-bg': { default: 'gray.50' },
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CacheProvider>
      <SaasProvider linkComponent={NextLink} theme={appTheme}>
        {children}
      </SaasProvider>
    </CacheProvider>
  )
}

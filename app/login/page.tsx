'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Grid minH="100vh" templateColumns={{ base: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
      <GridItem
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        justifyContent="center"
        px={{ lg: 16, xl: 24 }}
        py={12}
        bgGradient="linear(160deg, gray.900 0%, cyan.800 40%, teal.700 100%)"
        color="white"
        position="relative"
        overflow="hidden"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.15}
          bgImage="radial-gradient(circle at 20% 30%, white 0%, transparent 45%), radial-gradient(circle at 80% 70%, white 0%, transparent 40%)"
        />
        <Stack spacing={6} position="relative" maxW="md">
          <Text fontSize="sm" fontWeight="semibold" color="cyan.100" textTransform="uppercase" letterSpacing="wider">
            RepReady
          </Text>
          <Heading size="2xl" lineHeight="shorter">
            Liviniti's sales sandbox
          </Heading>
        </Stack>
      </GridItem>

      <GridItem display="flex" alignItems="center" justifyContent="center" px={4} py={12} bg="gray.50">
        <Box w="full" maxW="md">
          <Stack spacing={2} mb={8} textAlign={{ base: 'center', lg: 'left' }}>
            <Heading size="lg">Welcome back</Heading>
            <Text color="gray.500" fontSize="sm">
              Sign in to continue training
            </Text>
          </Stack>

          <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="2xl" boxShadow="md" p={{ base: 6, md: 8 }}>
            <form onSubmit={handleSubmit}>
              <Stack spacing={5}>
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Password</FormLabel>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    size="lg"
                  />
                </FormControl>

                {error && (
                  <Alert status="error" borderRadius="lg" fontSize="sm">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <Button type="submit" colorScheme="cyan" size="lg" isLoading={loading} w="full">
                  Sign in
                </Button>
              </Stack>
            </form>
          </Box>
        </Box>
      </GridItem>
    </Grid>
  )
}
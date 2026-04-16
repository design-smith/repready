'use client'

import { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import SimulationForm from '@/components/SimulationForm'
import type { SimulationTemplate, SimulationFormData } from '@/types'

const CATEGORY_SCHEME: Record<string, string> = {
  Discovery: 'blue',
  'Objection Handling': 'orange',
  Closing: 'green',
}

function categoryColor(category: string): string {
  return CATEGORY_SCHEME[category] ?? 'gray'
}

export default function NewSimulationClient({
  templates,
}: {
  templates: SimulationTemplate[]
}) {
  const [templateKey, setTemplateKey] = useState<string | null>(null)
  const [templateData, setTemplateData] = useState<SimulationFormData | null>(null)
  const [showTemplates, setShowTemplates] = useState(templates.length > 0)

  function applyTemplate(template: SimulationTemplate) {
    setTemplateData(template.snapshot)
    setTemplateKey(template.id)
    setShowTemplates(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Box>
      {showTemplates && (
        <Box mb={10}>
          <HStack justify="space-between" align="center" mb={4}>
            <Heading size="sm" color="gray.700">
              Start from a template
            </Heading>
            <Button variant="ghost" size="sm" colorScheme="gray" onClick={() => setShowTemplates(false)}>
              Skip →
            </Button>
          </HStack>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
            {templates.map((template) => (
              <Box
                key={template.id}
                as="button"
                type="button"
                textAlign="left"
                onClick={() => applyTemplate(template)}
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="xl"
                p={5}
                bg="white"
                boxShadow="sm"
                transition="all 0.2s"
                _hover={{
                  borderColor: 'cyan.300',
                  boxShadow: 'md',
                  bg: 'cyan.50',
                }}
              >
                <HStack justify="space-between" align="flex-start" mb={2} gap={2}>
                  <Text fontWeight="semibold" color="gray.800">
                    {template.title}
                  </Text>
                  <Badge colorScheme={categoryColor(template.category)} variant="subtle" borderRadius="full">
                    {template.category}
                  </Badge>
                </HStack>
                <Text fontSize="sm" color="gray.600" lineHeight="tall">
                  {template.description}
                </Text>
                <Text fontSize="xs" fontWeight="semibold" color="cyan.600" mt={3}>
                  Use template →
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {!showTemplates && templates.length > 0 && (
        <HStack mb={8} spacing={4} flexWrap="wrap">
          <Button variant="link" colorScheme="cyan" size="sm" onClick={() => setShowTemplates(true)}>
            ← Choose a different template
          </Button>
          {templateData && (
            <Text fontSize="sm" color="gray.500">
              or{' '}
              <Button
                variant="link"
                colorScheme="gray"
                size="sm"
                onClick={() => {
                  setTemplateData(null)
                  setTemplateKey(null)
                }}
              >
                start blank
              </Button>
            </Text>
          )}
        </HStack>
      )}

      <SimulationForm key={templateKey ?? 'blank'} mode="create" templateData={templateData ?? undefined} />
    </Box>
  )
}

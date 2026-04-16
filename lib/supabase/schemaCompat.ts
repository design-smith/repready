function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return ''

  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  const details = 'details' in error && typeof error.details === 'string' ? error.details : ''
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : ''

  return `${message} ${details} ${hint}`.toLowerCase()
}

export function isMissingPersonaVoiceColumnError(error: unknown): boolean {
  const text = getErrorMessage(error)

  return (
    text.includes('persona_voice') &&
    (text.includes('column') || text.includes('schema cache') || text.includes('could not find'))
  )
}

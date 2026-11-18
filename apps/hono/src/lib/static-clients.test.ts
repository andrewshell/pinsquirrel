import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reconcileStaticClients } from './static-clients'

const info = vi.fn()
const error = vi.fn()

vi.mock('./logger', () => ({
  logger: {
    info: (...a: unknown[]) => {
      info(...a)
    },
    error: (...a: unknown[]) => {
      error(...a)
    },
  },
  safeError: (err: unknown) => ({ message: (err as Error).message }),
}))

const entry = (clientId: string) => ({
  clientId,
  clientName: null,
  redirectUris: ['https://acme.example.com/callback'],
})

describe('reconcileStaticClients', () => {
  beforeEach(() => {
    info.mockClear()
    error.mockClear()
  })

  it('logs each entry that failed by its client_id, then the totals', async () => {
    const service = {
      reconcileStaticClients: vi.fn().mockResolvedValue([
        {
          clientId: 'broken',
          error: new Error('Lock wait timeout exceeded'),
        },
      ]),
    }

    await reconcileStaticClients(service, [entry('broken'), entry('acme')])

    expect(error).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledWith(
      {
        clientId: 'broken',
        error: { message: 'Lock wait timeout exceeded' },
      },
      'Could not reconcile a static OAuth client'
    )
    expect(info).toHaveBeenCalledWith(
      { clients: 2, failed: 1 },
      'Reconciled static OAuth clients'
    )
  })

  it('logs no error when every entry reconciles', async () => {
    const service = { reconcileStaticClients: vi.fn().mockResolvedValue([]) }

    await reconcileStaticClients(service, [entry('acme')])

    expect(error).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith(
      { clients: 1, failed: 0 },
      'Reconciled static OAuth clients'
    )
  })
})

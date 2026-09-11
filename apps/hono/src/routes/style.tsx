import { Hono } from 'hono'
import { StyleGuidePage } from '../views/pages/style-guide'
import { isEmbedRequest } from '../lib/embed'
import { getSessionManager } from '../middleware/session'

const styleRoutes = new Hono()

// GET /style - Style guide / accessibility scanning page
styleRoutes.get('/style', async c => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()
  return c.html(<StyleGuidePage user={user} embed={isEmbedRequest(c)} />)
})

export { styleRoutes }

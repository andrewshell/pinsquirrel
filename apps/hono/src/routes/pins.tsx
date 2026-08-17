import { Hono } from 'hono'
import { requireAuth } from '../middleware/session'
import { createPinRoutes } from './pin-routes'

const pins = new Hono()

pins.use('*', requireAuth())
pins.route('/', createPinRoutes({ baseUrl: '/pins' }))

export { pins as pinsRoutes }

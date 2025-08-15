import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  route('register', 'routes/register.tsx'),
  route('profile', 'routes/profile.tsx'),
  route('pins', 'routes/pins.tsx'),
  route('pins/new', 'routes/pins.new.tsx'),
  route('pins/:id/edit', 'routes/pins.$id.edit.tsx'),
  route('logout', 'routes/logout.tsx'),
  route('api/metadata', 'routes/api.metadata.tsx'),
  route('privacy', 'routes/privacy.tsx'),
  route('terms', 'routes/terms.tsx'),

  // Catch-all route for 404s and well-known requests (must be last)
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig

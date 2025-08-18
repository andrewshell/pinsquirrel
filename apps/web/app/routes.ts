import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('signin', 'routes/signin.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('profile', 'routes/profile.tsx'),
  route(':username/pins', 'routes/$username.pins.tsx', [
    route('new', 'routes/$username.pins.new.tsx'),
    route(':id/edit', 'routes/$username.pins.$id.edit.tsx'),
    route(':id/delete', 'routes/$username.pins.$id.delete.tsx'),
  ]),
  route('logout', 'routes/logout.tsx'),
  route('api/metadata', 'routes/api.metadata.tsx'),
  route('privacy', 'routes/privacy.tsx'),
  route('terms', 'routes/terms.tsx'),

  // Catch-all route for 404s and well-known requests (must be last)
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig

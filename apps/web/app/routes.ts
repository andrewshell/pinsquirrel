import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('signin', 'routes/signin.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('forgot-password', 'routes/forgot-password.tsx'),
  route('reset-password/:token', 'routes/reset-password.$token.tsx'),
  route('profile', 'routes/profile.tsx'),
  route('import', 'routes/import.tsx'),
  route('pins', 'routes/pins.tsx'),
  route('pins/new', 'routes/pins.new.tsx'),
  route('pins/:id/edit', 'routes/pins.$id.edit.tsx'),
  route('pins/:id/delete', 'routes/pins.$id.delete.tsx'),
  route('tags', 'routes/tags.tsx'),
  route('tags/merge', 'routes/tags.merge.tsx'),
  route('logout', 'routes/logout.tsx'),
  route('api/metadata', 'routes/api/metadata.tsx'),
  route('privacy', 'routes/privacy.tsx'),
  route('terms', 'routes/terms.tsx'),

  // Catch-all route for 404s and well-known requests (must be last)
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig

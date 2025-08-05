import { z } from 'zod'

export const pinCreationSchema = z.object({
  url: z.string().min(1, 'URL is required').url('Invalid URL format'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
})

export type PinCreationFormData = z.infer<typeof pinCreationSchema>
import React, { useState } from 'react'
import { useSubmit, useActionData } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const submit = useSubmit()
  const actionData = useActionData<{ error: string | null }>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🎯 LoginForm.handleSubmit called with:', {
      username,
      hasPassword: !!password,
    })

    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)

    void submit(formData, { method: 'post' })
  }

  // Note: Successful login will redirect automatically via createUserSession

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {actionData?.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {actionData.error}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

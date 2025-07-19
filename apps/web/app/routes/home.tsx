import type { Route } from './+types/home'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'shadcn/ui Test' },
    { name: 'description', content: 'Testing shadcn/ui components' },
  ]
}

export default function Home() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">shadcn/ui Component Test</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {/* Basic Card */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Card</CardTitle>
            <CardDescription>This is a simple card example</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This card demonstrates the basic structure with header, content, and footer sections.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Action</Button>
          </CardFooter>
        </Card>

        {/* Interactive Card */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader>
            <CardTitle>Interactive Card</CardTitle>
            <CardDescription>Hover over this card</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-primary" />
              <span className="text-sm">Status: Active</span>
            </div>
            <p className="text-sm text-muted-foreground">
              This card has hover effects and demonstrates different styling options.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm">Cancel</Button>
            <Button size="sm">Confirm</Button>
          </CardFooter>
        </Card>

        {/* Feature Card */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Showcase</CardTitle>
            <CardDescription>Multiple button variants</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="default" className="w-full">Default</Button>
            <Button variant="secondary" className="w-full">Secondary</Button>
            <Button variant="outline" className="w-full">Outline</Button>
            <Button variant="ghost" className="w-full">Ghost</Button>
            <Button variant="destructive" className="w-full" size="sm">Destructive</Button>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,543</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>

        {/* Card with List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Project deployed</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-sm">New user registered</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                <span className="text-sm">Payment pending</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Minimal Card */}
        <Card className="border-0 shadow-none bg-muted">
          <CardHeader>
            <CardTitle className="text-lg">Minimal Style</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              This card uses custom classes to create a minimal appearance without borders.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dark Mode Toggle Test */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Toggle your system&apos;s dark mode to see how the components adapt
        </p>
        <div className="flex justify-center gap-4">
          <div className="px-4 py-2 rounded bg-background border">
            <span className="text-foreground">Background</span>
          </div>
          <div className="px-4 py-2 rounded bg-card border">
            <span className="text-card-foreground">Card</span>
          </div>
          <div className="px-4 py-2 rounded bg-primary">
            <span className="text-primary-foreground">Primary</span>
          </div>
          <div className="px-4 py-2 rounded bg-secondary">
            <span className="text-secondary-foreground">Secondary</span>
          </div>
        </div>
      </div>
    </div>
  )
}

# Neo Brutalism Style Guide

> PinSquirrel UI Component Reference
> Last Updated: 2026-02-01

This guide defines the Neo Brutalism design system used throughout the Hono app. Use these patterns to maintain visual consistency when creating new components.

## 1. Design Philosophy

Neo Brutalism is characterized by:

- **Sharp corners** - No border-radius (`--radius: 0`)
- **Heavy visible borders** - 2px or 4px solid borders
- **Hard offset shadows** - No blur, solid black offset
- **High contrast** - Black borders on white backgrounds
- **Bold typography** - Heavy weights, uppercase transforms
- **Playful interactivity** - Physical button press effects

## 2. Color System

Colors are defined using OKLch color space for perceptual uniformity.

### Semantic Colors (CSS Variables)

```css
/* Light Mode */
--background: oklch(1 0 0); /* Pure white */
--foreground: oklch(0 0 0); /* Pure black */
--card: oklch(1 0 0); /* White */
--primary: oklch(0.7 0.3 200); /* Vibrant cyan/blue */
--primary-foreground: oklch(0 0 0); /* Black text on primary */
--secondary: oklch(0.8 0.2 280); /* Soft purple */
--muted: oklch(0.9 0 0); /* Light gray */
--muted-foreground: oklch(0.3 0 0); /* Dark gray text */
--accent: oklch(0.7 0.3 200); /* Same as primary */
--destructive: oklch(0.65 0.3 15); /* Vibrant red */

/* Dark Mode */
--background: oklch(0 0 0); /* Pure black */
--foreground: oklch(1 0 0); /* Pure white */
--muted: oklch(0.2 0 0); /* Dark gray */
--muted-foreground: oklch(0.7 0 0); /* Light gray text */
```

### Usage Patterns

```html
<!-- Background/Foreground -->
<div class="bg-background text-foreground">
  <!-- Primary action -->
  <button class="bg-primary text-primary-foreground">
    <!-- Secondary/subtle -->
    <div class="bg-secondary text-secondary-foreground">
      <!-- Muted/subdued -->
      <span class="text-muted-foreground">
        <!-- Destructive/danger -->
        <button class="bg-destructive text-destructive-foreground">
          <!-- Links and accents -->
          <a class="text-accent hover:text-accent/80"></a></button
      ></span>
    </div>
  </button>
</div>
```

### Status Colors

For flash messages and alerts, use Tailwind's color palette with dark mode variants:

| Type    | Light Background | Light Text        | Dark Background       | Dark Text              |
| ------- | ---------------- | ----------------- | --------------------- | ---------------------- |
| Success | `bg-green-50`    | `text-green-700`  | `dark:bg-green-950`   | `dark:text-green-200`  |
| Error   | `bg-red-50`      | `text-red-700`    | `dark:bg-red-950`     | `dark:text-red-200`    |
| Warning | `bg-yellow-50`   | `text-yellow-700` | `dark:bg-yellow-900`  | `dark:text-yellow-100` |
| Info    | `bg-blue-50`     | `text-blue-700`   | `dark:bg-blue-900/20` | `dark:text-blue-200`   |

## 3. Typography

### Font Family

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
```

### Font Weights

| Weight | Variable        | Usage                      |
| ------ | --------------- | -------------------------- |
| 500    | `font-medium`   | Form labels, body emphasis |
| 600    | `font-semibold` | Secondary headings         |
| 700    | `font-bold`     | Buttons, links, timestamps |
| 900    | `font-black`    | Brand name, hero text      |

### Text Transforms

- **Buttons**: Always `uppercase`
- **Navigation links**: `uppercase`
- **Brand/logo**: `uppercase tracking-tight`
- **Body text**: Normal case

### Common Patterns

```html
<!-- Brand/Logo -->
<span class="text-2xl font-black uppercase tracking-tight">PinSquirrel</span>

<!-- Page heading -->
<h1 class="text-3xl font-bold">Welcome Back</h1>

<!-- Card heading -->
<h2 class="text-xl font-bold">Sign In</h2>

<!-- Muted helper text -->
<p class="text-muted-foreground text-sm">Supporting text</p>

<!-- Link in text -->
<a href="#" class="text-primary hover:underline font-medium">Click here</a>
```

## 4. Shadow System

Five shadow utilities for the Neo Brutalism effect:

```css
.neobrutalism-shadow {
  box-shadow: 4px 4px 0 0 var(--foreground); /* Default */
}
.neobrutalism-shadow-sm {
  box-shadow: 2px 2px 0 0 var(--foreground); /* Small/inputs */
}
.neobrutalism-shadow-lg {
  box-shadow: 8px 8px 0 0 var(--foreground); /* Large/hero */
}
.neobrutalism-shadow-hover {
  box-shadow: 6px 6px 0 0 var(--foreground); /* Hover state */
}
.neobrutalism-shadow-pressed {
  box-shadow: 2px 2px 0 0 var(--foreground); /* Active/pressed */
}
```

### When to Use Each

| Shadow                        | Use Case                             |
| ----------------------------- | ------------------------------------ |
| `neobrutalism-shadow`         | Buttons, cards, primary containers   |
| `neobrutalism-shadow-sm`      | Input fields, small elements         |
| `neobrutalism-shadow-lg`      | Hero sections, featured cards        |
| `neobrutalism-shadow-hover`   | Button hover state (with translate)  |
| `neobrutalism-shadow-pressed` | Button active state (with translate) |

## 5. Border Patterns

### Standard Border

```html
<div class="border-2 border-foreground"></div>
```

### Heavy Border (Headers, Emphasis)

```html
<header class="border-b-4 border-foreground"></header>
```

### Border Reveal on Hover

Used for navigation links - transparent border becomes visible on hover:

```html
<a
  class="border-2 border-transparent hover:border-foreground transition-all"
></a>
```

### Divider

```html
<hr class="border-foreground/20" />
```

## 6. Interactive States

### Button Interaction Pattern

The signature Neo Brutalism button effect uses translate + shadow changes:

```
Default:   translate(0, 0)     + neobrutalism-shadow
Hover:     translate(-2px, -2px) + neobrutalism-shadow-hover
Active:    translate(2px, 2px)   + neobrutalism-shadow-pressed
```

```html
<button
  class="neobrutalism-shadow
               hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
               active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
               transition-all"
></button>
```

### Focus States

```html
<input
  class="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
/>
```

### Disabled States

```html
<button
  class="disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed"
></button>
```

### Hover Backgrounds

```html
<!-- Subtle hover for list items -->
<div class="hover:bg-accent/5 transition-all">
  <!-- Dropdown items -->
  <a class="hover:bg-accent/10 transition-colors"></a>
</div>
```

## 7. Component Patterns

### Button Component

Four variants available via the `Button` component:

```tsx
// Default - Primary action
<Button>Save Changes</Button>

// Outline - Secondary action
<Button variant="outline">Cancel</Button>

// Destructive - Danger action
<Button variant="destructive">Delete</Button>

// Ghost - Minimal/icon buttons
<Button variant="ghost">...</Button>
```

#### Raw Button Classes

**Default Button:**

```html
<button
  class="inline-flex items-center justify-center gap-2 whitespace-nowrap
               font-bold uppercase border-2 border-foreground
               bg-primary text-primary-foreground
               h-11 px-6 py-3 text-sm
               neobrutalism-shadow transition-all
               hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
               active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
               disabled:pointer-events-none disabled:opacity-50"
>
  Button Text
</button>
```

**Outline Button:**

```html
<button class="... bg-background text-foreground"></button>
```

**Destructive Button:**

```html
<button class="... bg-destructive text-destructive-foreground"></button>
```

**Ghost Button:**

```html
<button
  class="... border-transparent shadow-none
               hover:shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-accent/10"
></button>
```

#### Button Sizes

| Size      | Classes                  |
| --------- | ------------------------ |
| `sm`      | `h-9 px-3 text-sm`       |
| `default` | `h-11 px-6 py-3 text-sm` |
| `lg`      | `h-14 px-8 text-base`    |
| `icon`    | `h-11 w-11 p-0`          |

### Input Fields

```html
<input
  class="w-full px-3 py-2 border-2 border-foreground bg-background
              neobrutalism-shadow-sm
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
/>
```

**With Error State:**

```html
<input class="... border-red-500" aria-invalid="true" />
<p class="text-sm text-red-600 font-medium">Error message</p>
```

### Textarea

```html
<textarea
  class="w-full px-3 py-2 border-2 border-foreground bg-background
                 neobrutalism-shadow-sm resize
                 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
></textarea>
```

### Checkbox

```html
<input
  type="checkbox"
  class="h-4 w-4 border-2 border-foreground bg-background
                              focus:ring-2 focus:ring-primary focus:ring-offset-2"
/>
```

### Card Container

```html
<div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
  <h2 class="text-xl font-bold mb-4">Card Title</h2>
  <!-- Card content -->
</div>
```

### Navigation Link

```html
<a
  href="/page"
  class="text-base font-bold text-foreground hover:text-accent uppercase
          px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
>
  Nav Item
</a>
```

### Dropdown Menu

```html
<div class="relative" data-dropdown="container">
  <button
    data-dropdown="toggle"
    class="flex items-center gap-2 px-3 py-2 text-sm font-medium
                 border-2 border-foreground bg-background hover:bg-accent/10 transition-colors"
  >
    Menu
  </button>
  <div
    class="hidden absolute right-0 mt-2 w-48 bg-background
              border-2 border-foreground shadow-lg z-50"
    data-dropdown="menu"
  >
    <a
      href="#"
      class="block px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
    >
      Item 1
    </a>
    <hr class="border-foreground/20" />
    <a
      href="#"
      class="block px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
    >
      Item 2
    </a>
  </div>
</div>
```

### Flash Messages

```html
<!-- Success -->
<div
  class="p-3 text-sm border-2 neobrutalism-shadow
            text-green-700 bg-green-50 border-green-200
            dark:text-green-200 dark:bg-green-950 dark:border-green-800"
  role="status"
>
  Success message
</div>

<!-- Error -->
<div
  class="p-3 text-sm border-2 neobrutalism-shadow
            text-red-700 bg-red-50 border-red-200
            dark:text-red-200 dark:bg-red-950 dark:border-red-800"
  role="alert"
>
  Error message
</div>

<!-- Warning -->
<div
  class="p-3 text-sm border-2 neobrutalism-shadow
            text-yellow-700 bg-yellow-50 border-yellow-200
            dark:text-yellow-100 dark:bg-yellow-900 dark:border-yellow-700"
  role="status"
>
  Warning message
</div>

<!-- Info -->
<div
  class="p-3 text-sm border-2 neobrutalism-shadow
            text-blue-700 bg-blue-50 border-blue-200
            dark:text-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
  role="status"
>
  Info message
</div>
```

### Text Links

```html
<!-- Primary link -->
<a href="#" class="text-primary hover:underline font-medium">Link</a>

<!-- Accent link (in lists) -->
<a href="#" class="text-accent hover:text-accent/80 hover:underline">Link</a>

<!-- Destructive link -->
<a
  href="#"
  class="text-destructive hover:text-destructive/80 font-bold hover:underline"
  >Delete</a
>
```

## 8. Layout Patterns

### Page Container

```html
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"></div>
```

### Centered Form Container

```html
<div class="flex flex-col items-center justify-center px-4 py-16">
  <div class="w-full max-w-md">
    <!-- Form content -->
  </div>
</div>
```

### Header

```html
<header class="w-full bg-background border-b-4 border-foreground">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-20">
      <!-- Logo left, nav right -->
    </div>
  </div>
</header>
```

### Form Field Group

```html
<div class="space-y-2">
  <label for="field" class="block text-sm font-medium">Field Label</label>
  <input id="field" ... />
  <p class="text-sm text-red-600 font-medium">Error if any</p>
</div>
```

## 9. Common Class Combinations

### Interactive Card Item

```html
<div class="py-2 hover:bg-accent/5 transition-all"></div>
```

### Form Submit Button (Full Width)

```html
<button
  type="submit"
  class="w-full px-4 py-2 bg-primary text-primary-foreground font-medium
               border-2 border-foreground neobrutalism-shadow
               hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
               active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
               transition-all disabled:opacity-50 disabled:cursor-not-allowed"
></button>
```

### Icon Button

```html
<a
  href="#"
  class="px-3 py-2 bg-primary text-primary-foreground font-medium
                   border-2 border-foreground neobrutalism-shadow
                   hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                   active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                   transition-all"
  aria-label="Action"
>
  <svg ...>...</svg>
</a>
```

### Tag/Pill

```html
<span
  class="inline-block px-2 py-0.5 text-xs font-medium
             bg-muted text-muted-foreground border border-foreground"
>
  Tag
</span>
```

## 10. Quick Reference

### Must-Have Classes for Neo Brutalism

| Element | Essential Classes                                                    |
| ------- | -------------------------------------------------------------------- |
| Button  | `border-2 border-foreground neobrutalism-shadow font-bold uppercase` |
| Input   | `border-2 border-foreground neobrutalism-shadow-sm bg-background`    |
| Card    | `border-2 border-foreground neobrutalism-shadow bg-card`             |
| Header  | `border-b-4 border-foreground bg-background`                         |
| Link    | `font-bold text-accent hover:text-accent/80`                         |
| Flash   | `border-2 neobrutalism-shadow` + status colors                       |

### Animation Classes

Always include `transition-all` or `transition-colors` for smooth state changes.

### Accessibility

- Use `role="alert"` for error messages
- Use `role="status"` for success/info messages
- Use `aria-invalid="true"` on inputs with errors
- Use `aria-label` on icon-only buttons

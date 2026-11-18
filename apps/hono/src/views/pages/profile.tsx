import type { User } from '@pinsquirrel/domain'
import type { OAuthGrant } from '@pinsquirrel/services'
import type { FlashMessage } from '../../middleware/session'
import {
  ErrorMessage,
  FlashMessage as FlashMessageComponent,
} from '../components/FlashMessage'
import { DefaultLayout } from '../layouts/default'
import { AccountCard } from './profile/AccountCard'
import { BookmarkletCard } from './profile/BookmarkletCard'
import { EmailForm } from './profile/EmailForm'
import { OAuthGrantsCard } from './profile/OAuthGrantsCard'
import { PasswordForm } from './profile/PasswordForm'

export const PROFILE_INTENTS = [
  'update-email',
  'change-password',
  'revoke-oauth-grant',
] as const

export type ProfileIntent = (typeof PROFILE_INTENTS)[number]

interface ProfilePageProps {
  user: User
  flash?: FlashMessage | null
  errors?: Record<string, string[]>
  failedIntent?: ProfileIntent
  grants?: OAuthGrant[]
  embed?: boolean
}

/**
 * The profile page is a stack of independent cards, one per file under
 * `profile/`. Adding or removing a card is a one-file change plus a line here.
 */
export function ProfilePage({
  user,
  flash,
  errors,
  failedIntent,
  grants,
  embed = false,
}: ProfilePageProps) {
  const formError = errors?._form?.[0]
  const errorFor = (intent: ProfileIntent) =>
    failedIntent === intent ? formError : undefined

  return (
    <DefaultLayout
      title="Profile"
      user={user}
      currentPath="/profile"
      width="narrow"
      embed={embed}
    >
      {/* Flash message */}
      {flash && (
        <FlashMessageComponent
          type={flash.type}
          message={flash.message}
          className="mb-6"
        />
      )}

      {formError && !failedIntent && (
        <ErrorMessage message={formError} className="mb-6" />
      )}

      {/* Page title */}
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-foreground">Profile</h1>
        <p class="mt-2 text-muted-foreground">
          Manage your account information
        </p>
      </div>

      <div class="space-y-6">
        <AccountCard user={user} />
        <EmailForm
          user={user}
          errors={errors}
          formError={errorFor('update-email')}
          embed={embed}
        />
        <PasswordForm
          user={user}
          errors={errors}
          formError={errorFor('change-password')}
          embed={embed}
        />
        <OAuthGrantsCard
          grants={grants}
          formError={errorFor('revoke-oauth-grant')}
          embed={embed}
        />
        <BookmarkletCard />
      </div>
    </DefaultLayout>
  )
}

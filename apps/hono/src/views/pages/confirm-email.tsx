import type { FC } from 'hono/jsx'
import { DefaultLayout } from '../layouts/default'
import { ErrorMessage, SuccessMessage } from '../components/FlashMessage'

type ConfirmEmailPageProps =
  { state: 'ask'; token: string } | { state: 'done' } | { state: 'invalid' }

const buttonClass = `block w-full px-4 py-2 text-center bg-primary text-primary-foreground font-medium
  border-2 border-foreground neobrutalism-shadow
  hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
  active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
  transition-all`

/**
 * The page a confirmation link opens. The change is applied by the form's
 * POST, never by the GET, so a link scanner that fetches it changes nothing.
 */
export const ConfirmEmailPage: FC<ConfirmEmailPageProps> = props => (
  <DefaultLayout title="Confirm Email Address" user={null}>
    <div class="flex flex-col items-center justify-center px-4 py-16">
      <div class="w-full max-w-md bg-card border-2 border-foreground neobrutalism-shadow p-6">
        <h1 class="text-xl font-bold mb-4">Confirm your new email address</h1>
        {props.state === 'ask' && (
          <form
            method="post"
            action={`/confirm-email/${encodeURIComponent(props.token)}`}
          >
            <p class="text-muted-foreground mb-4">
              Use this address for your PinSquirrel account from now on.
            </p>
            <button type="submit" class={buttonClass}>
              Confirm new address
            </button>
          </form>
        )}
        {props.state === 'done' && (
          <>
            <SuccessMessage
              message="Your email address has been changed."
              className="mb-4"
            />
            <a href="/profile" class={buttonClass}>
              Go to your profile
            </a>
          </>
        )}
        {props.state === 'invalid' && (
          <>
            <ErrorMessage
              message="This link is invalid or has expired."
              className="mb-4"
            />
            <p class="text-muted-foreground">
              Ask for the change again from your profile.
            </p>
          </>
        )}
      </div>
    </div>
  </DefaultLayout>
)

// Type declarations for Google Identity Services (GIS)
// https://developers.google.com/identity/gsi/web/reference/js-reference

interface CredentialResponse {
  credential: string
  select_by: string
  clientId?: string
}

interface GsiButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: string
  locale?: string
}

interface IdConfiguration {
  client_id: string
  callback: (response: CredentialResponse) => void
  auto_select?: boolean
  login_uri?: string
  native_callback?: (response: CredentialResponse) => void
  cancel_on_tap_outside?: boolean
  prompt_parent_id?: string
  nonce?: string
  context?: 'signin' | 'signup' | 'use'
  state_cookie_domain?: string
  ux_mode?: 'popup' | 'redirect'
  allowed_parent_origin?: string | string[]
  intermediate_iframe_close_callback?: () => void
  itp_support?: boolean
  login_hint?: string
  hd?: string
  use_fedcm_for_prompt?: boolean
}

interface GoogleAccountsId {
  initialize: (config: IdConfiguration) => void
  prompt: (momentListener?: (notification: PromptMomentNotification) => void) => void
  renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void
  disableAutoSelect: () => void
  storeCredential: (credential: { id: string; password: string }, callback?: () => void) => void
  cancel: () => void
  revoke: (hint: string, callback?: (response: { successful: boolean; error?: string }) => void) => void
}

interface PromptMomentNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () => string
  isSkippedMoment: () => boolean
  getSkippedReason: () => string
  isDismissedMoment: () => boolean
  getDismissedReason: () => string
}

interface Google {
  accounts: {
    id: GoogleAccountsId
  }
}

declare global {
  interface Window {
    google?: Google
  }
}

export {}

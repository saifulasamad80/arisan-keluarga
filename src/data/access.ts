export const MASTER_ADMIN_EMAIL = 'ajip3580@gmail.com'

export function isMasterAdminEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase() === MASTER_ADMIN_EMAIL
}

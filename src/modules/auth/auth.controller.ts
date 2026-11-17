import { supabaseAdmin } from '../../config/supabase';
import { getAuthUser } from '../../middleware/auth';
import { AppError, asyncHandler } from '../../middleware/error';

/**
 * Social sign-in must only admit existing accounts. Supabase creates the user
 * during the OAuth exchange, before the client can inspect it, so the client
 * calls this endpoint afterwards. When the account was created by this exact
 * sign-in, delete it so the user has to go through the sign-up screen.
 */
export const checkOAuthSignIn = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.id);
  if (error || !data.user) {
    throw new AppError(500, 'AUTH_USER_FETCH_FAILED', 'Could not load the account');
  }

  const account = data.user;
  const provider = account.app_metadata?.provider;
  const isOAuth = provider === 'google';
  const identities = account.identities ?? [];
  const onlyOAuthIdentity = identities.length === 1 && identities[0]?.provider === provider;
  const created = Date.parse(account.created_at);
  const last = account.last_sign_in_at ? Date.parse(account.last_sign_in_at) : created;
  const fresh =
    Number.isFinite(created) && Number.isFinite(last) && last >= created && last - created < 10_000;

  if (!isOAuth || !onlyOAuthIdentity || !fresh) {
    res.status(200).json({ deleted: false });
    return;
  }

  const deleted = await supabaseAdmin.auth.admin.deleteUser(account.id);
  if (deleted.error) {
    throw new AppError(500, 'OAUTH_ACCOUNT_DELETE_FAILED', 'Could not remove the new account');
  }

  res.status(200).json({ deleted: true });
});

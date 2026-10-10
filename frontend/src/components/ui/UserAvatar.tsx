import { Avatar, type AvatarProps } from '@chakra-ui/react';
import type { UserSummary } from '../../types';

export interface UserAvatarProps extends Omit<AvatarProps, 'name' | 'src'> {
  /** `null` renders a neutral grey avatar for a deleted account. */
  user: UserSummary | null;
}

/** Avatar for a user summary that gracefully handles deleted accounts. */
export function UserAvatar({ user, ...rest }: UserAvatarProps) {
  if (!user) {
    return <Avatar bg="gray.400" color="white" aria-label="Deleted user" {...rest} />;
  }
  return <Avatar name={user.full_name?.trim() || user.email} src={user.avatar_url ?? undefined} {...rest} />;
}

export default UserAvatar;

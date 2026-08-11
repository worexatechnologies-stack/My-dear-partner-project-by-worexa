/**
 * Backwards-compatible import path for the authenticated profile-photo
 * renderer. New code should import from `components/profile/ProfileImage`.
 */
export { default } from '@/components/profile/ProfileImage';
export type {
  ProfileImageAspectRatio,
  ProfileImageProps,
  ProfileImageShape,
  ProfileImageSize,
  ProfilePhotoVariant,
} from '@/components/profile/ProfileImage';

export function inviteUrl(origin: string, pathname: string) {
  return `${origin}${pathname}`.replace(/\/$/, '') + '/';
}

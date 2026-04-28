/**
 * Merge class names (simple utility; extend with clsx if needed).
 * @param {...(string | false | undefined | null)} classes
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

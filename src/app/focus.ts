/**
 * Where the focus goes when the screen changes (SPEC §8.3): to the new screen's heading, so Tab
 * carries on from there and a screen reader says where it is. Never when the focus is already
 * inside the screen, as when a typed answer's field took it.
 */
export function focusScreenHeading(): void {
  const main = document.querySelector('main');
  if (main === null) return;
  const active = document.activeElement;
  if (active !== null && active !== document.body && main.contains(active)) return;
  const heading = main.querySelector('h1');
  if (heading === null) return;
  heading.tabIndex = -1; // focusable from code only; base.css draws no ring for it
  heading.focus({ preventScroll: true });
}

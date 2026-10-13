/** Square ✕ button, absolutely placed top-right: the parent must be a positioned ancestor (HudCard is) with room for it. */
export function CloseButton({
  onClick,
  label,
  testId,
  hud,
  touch = false,
}: {
  onClick: () => void;
  label: string;
  testId: string;
  hud?: string;
  /** 44x44 px touch target (phone sheet, #25); a prop because a className cannot override the size. */
  touch?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      data-hud={hud}
      // z-10: the Advanced column's fade animation (fill both) would otherwise paint over a z-auto absolute button (#23, #25).
      className={`absolute z-10 rounded-hud text-hud-muted ${
        touch ? 'top-0 right-0 h-11 w-11' : 'top-1.5 right-1.5 px-1.5'
      } hover:bg-white/10 hover:text-hud-bright`}
    >
      ✕
    </button>
  );
}

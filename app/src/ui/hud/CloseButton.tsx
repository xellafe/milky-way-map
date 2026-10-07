/** Square ✕ button, absolutely placed top-right: the parent must be a positioned ancestor (HudCard is) with room for it. */
export function CloseButton({
  onClick,
  label,
  testId,
  hud,
}: {
  onClick: () => void;
  label: string;
  testId: string;
  hud?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      data-hud={hud}
      className="absolute top-1.5 right-1.5 rounded-hud px-1.5 text-hud-muted hover:bg-white/10 hover:text-hud-bright"
    >
      ✕
    </button>
  );
}

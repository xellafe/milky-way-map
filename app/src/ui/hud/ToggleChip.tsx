/** Pressable filter chip: filled with `color` when on, border only when off. */
export function ToggleChip({
  label,
  pressed,
  onToggle,
  color,
  testId,
  ariaLabel,
  touch = false,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  color?: string;
  testId: string;
  ariaLabel?: string;
  /** 44x44 px minimum (phone, #25). */
  touch?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onToggle}
      style={pressed && color ? { backgroundColor: color } : undefined}
      className={`border px-2 py-0.5 font-hud-mono text-xs ${touch ? 'min-h-11 min-w-11' : ''} ${
        pressed
          ? `border-transparent ${color ? 'text-black' : 'bg-hud-accent/30 text-hud-bright'}`
          : 'border-hud-accent/30 text-hud-muted hover:text-hud-text'
      }`}
    >
      {label}
    </button>
  );
}

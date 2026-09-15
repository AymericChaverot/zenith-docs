export const CALLOUT_TYPES = ['note', 'tip', 'success', 'warning', 'danger'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

const CALLOUT_ALIASES: Record<string, CalloutType> = {
  note: 'note',
  info: 'note',
  important: 'note',
  tip: 'tip',
  idea: 'tip',
  success: 'success',
  check: 'success',
  warning: 'warning',
  warn: 'warning',
  caution: 'warning',
  danger: 'danger',
  error: 'danger',
};

export const CALLOUT_TITLES: Record<CalloutType, string> = {
  note: 'Note',
  tip: 'Tip',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
};

/** Map a callout name or alias (`info`, `warn`, `caution`…) to its canonical type. */
export function resolveCalloutType(name: string): CalloutType | undefined {
  return CALLOUT_ALIASES[name.toLowerCase()];
}

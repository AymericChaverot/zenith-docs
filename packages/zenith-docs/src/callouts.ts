export const CALLOUT_TYPES = ['note', 'tip', 'important', 'success', 'warning', 'danger'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

export interface ResolvedCallout {
  type: CalloutType;
  /** Name or alias that was used, also the translation key. */
  name: string;
  /** Default title, based on the name that was used. */
  title: string;
}

/**
 * Callout names and aliases. GitHub alert names (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`)
 * each map to their own style, matching the colors used on GitHub.
 */
const CALLOUT_NAMES: Record<string, Omit<ResolvedCallout, 'name'>> = {
  note: { type: 'note', title: 'Note' },
  info: { type: 'note', title: 'Info' },
  tip: { type: 'tip', title: 'Tip' },
  idea: { type: 'tip', title: 'Idea' },
  important: { type: 'important', title: 'Important' },
  success: { type: 'success', title: 'Success' },
  check: { type: 'success', title: 'Success' },
  warning: { type: 'warning', title: 'Warning' },
  warn: { type: 'warning', title: 'Warning' },
  danger: { type: 'danger', title: 'Danger' },
  error: { type: 'danger', title: 'Error' },
  caution: { type: 'danger', title: 'Caution' },
};

/** Map a callout name or alias (`info`, `warn`, `caution`…) to its type and default title. */
export function resolveCallout(name: string): ResolvedCallout | undefined {
  const key = name.toLowerCase();
  const callout = CALLOUT_NAMES[key];
  return callout && { ...callout, name: key };
}

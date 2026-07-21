// The single source of truth for checkboxes across the app. A native
// <input type="checkbox"> (keeps keyboard, form semantics, and RTL for free)
// restyled to the blue design system in every state — unchecked, checked,
// indeterminate, hover, focus, disabled — via the `.ds-checkbox` class in
// global.css (tokens only). Forwards all native input props, so callers keep
// their own value/onChange/aria wiring; pass `indeterminate` for tri-state.
import { useEffect, useRef } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean };

export default function Checkbox({ indeterminate, className, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  // `indeterminate` is a DOM property only (no HTML attribute), so it must be set imperatively.
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return <input ref={ref} type="checkbox" className={'ds-checkbox' + (className ? ' ' + className : '')} {...rest} />;
}

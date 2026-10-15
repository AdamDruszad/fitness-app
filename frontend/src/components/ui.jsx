import { Link } from "react-router";
import { IconAlertTriangle, IconArrowLeft, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";

const NOTICE_ICONS = { error: IconAlertTriangle, warn: IconAlertTriangle, ok: IconCircleCheck, info: IconInfoCircle };

/** Back navigation for deep pages. */
export function BackLink({ to, children }) {
  return <Link to={to} className="back-link"><IconArrowLeft size={18} stroke={1.75} aria-hidden="true" />{children}</Link>;
}

/** Bordered message block. Pass `role="alert"` for errors that must be announced. */
export function Notice({ tone = "info", children, className = "", ...props }) {
  const Icon = NOTICE_ICONS[tone];
  return (
    <div className={`notice notice--${tone} ${className}`.trim()} {...props}>
      <Icon size={18} stroke={1.75} aria-hidden="true" />
      <div className="notice-body">{children}</div>
    </div>
  );
}

/** Loading row with a spinner; the text is the accessible status. */
export function LoadingLine({ children }) {
  return <p className="loading-line" role="status"><span className="spinner" aria-hidden="true" />{children}</p>;
}

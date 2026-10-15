/** Shared page header: eyebrow, condensed title, description and optional actions. */
export default function PageHeading({ eyebrow, title, description, children }) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        {eyebrow && <p className="eyebrow"><span className="bar" aria-hidden="true" />{eyebrow}</p>}
        <h1 className="page-title display">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  );
}

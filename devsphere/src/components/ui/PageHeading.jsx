export default function PageHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="page-title-row page-header">
      <div className="page-header__titles">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="welcome-actions page-actions">{actions}</div>}
    </div>
  );
}

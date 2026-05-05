import { Link } from 'react-router-dom';

export default function QuickActionCard({ to, href, icon: Icon, title, description, target, rel, className = '' }) {
  const classes = `quick-card ${className}`.trim();
  const content = (
    <>
      {Icon ? <Icon size={24} /> : null}
      <strong>{title}</strong>
      <p>{description}</p>
    </>
  );

  if (href || target === '_blank') {
    return (
      <a className={classes} href={href || to} target={target} rel={rel || (target === '_blank' ? 'noreferrer' : undefined)}>
        {content}
      </a>
    );
  }

  return (
    <Link className={classes} to={to}>
      {content}
    </Link>
  );
}

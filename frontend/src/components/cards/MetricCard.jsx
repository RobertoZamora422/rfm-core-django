import { TrendingUp } from 'lucide-react';

export default function MetricCard({ label, title, value, description, trend, icon: Icon }) {
  const heading = title || label;

  return (
    <article className="metric-card">
      <div className="metric-card-top">
        {Icon ? (
          <span className="metric-card-icon" aria-hidden="true">
            <Icon size={20} />
          </span>
        ) : null}
        <span>{heading}</span>
      </div>
      <strong>{value}</strong>
      {description ? <p>{description}</p> : null}
      {trend ? (
        <small className="metric-trend">
          <TrendingUp size={15} />
          {trend}
        </small>
      ) : null}
    </article>
  );
}

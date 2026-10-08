import { Link } from "react-router";

export default function Brand({ to = "/" }) {
  return <Link to={to} className="brand" aria-label="FitAI home"><span className="brand-symbol" aria-hidden="true" /><span>FitAI</span></Link>;
}

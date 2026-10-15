/**
 * @file NotFound.jsx
 * @description 404 Catch-All Page Component.
 * Displays a friendly 404 notice and a CTA button to navigate back to the dashboard.
 */

import Layout from "../components/Layout";
import { Link } from "react-router";
import { IconError404 } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <Layout width="narrow">
      <div className="not-found">
        <span className="not-found-code display" aria-hidden="true">404</span>
        <IconError404 size={40} stroke={1.5} className="sr-only" aria-hidden="true" />
        <h1 className="display not-found-title">Page not found</h1>
        <p className="muted">We couldn't find the page you're looking for. It might have been moved or doesn't exist.</p>
        <Link to="/" className="btn btn--primary btn--lg">Go back home</Link>
      </div>
    </Layout>
  );
}

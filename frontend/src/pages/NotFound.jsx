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
    <Layout>
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        {/* 404 Icon Illustration */}
        <IconError404 size={64} className="text-text-muted/50" stroke={1.5} aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text-main">Page not found</h1>
        <p className="text-text-muted text-sm max-w-sm">
          We couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        {/* Return to Dashboard CTA */}
        <Link
          to="/"
          className="mt-4 fitai-primary-button"
        >
          Go back home
        </Link>
      </div>
    </Layout>
  );
}

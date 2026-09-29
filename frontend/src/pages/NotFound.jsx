import Layout from "../components/Layout";
import { Link } from "react-router";
import { IconError404 } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <IconError404 size={64} className="text-text-muted/50" stroke={1.5} />
        <h1 className="text-2xl font-bold text-text-main">Page not found</h1>
        <p className="text-text-muted text-sm max-w-sm">
          We couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-4 border border-border-subtle bg-brand-accent rounded-lg py-2 px-6 font-medium text-text-main hover:bg-brand-accent/50 transition inline-block"
        >
          Go back home
        </Link>
      </div>
    </Layout>
  );
}

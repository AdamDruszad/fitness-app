/**
 * @file ErrorBoundary.jsx
 * @description React Error Boundary component capturing runtime render errors in child components.
 * Prevents full-application white screens and displays a graceful fallback error interface.
 */

import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  /**
   * Updates state so the next render will show the fallback UI.
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Catches errors in child components and logs diagnostic details.
   */
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-base flex items-center justify-center p-6 text-text-main">
          <div className="bg-surface border border-red-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
            <p className="text-text-muted text-sm mb-4">
              An unexpected application error occurred. You can reload the page or navigate back.
            </p>
            <details className="text-xs text-text-muted/80 bg-input p-3 rounded-lg overflow-x-auto whitespace-pre-wrap border border-border-subtle mb-4">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </details>
            <button
              onClick={() => window.location.reload()}
              className="bg-brand-accent text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition cursor-pointer"
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

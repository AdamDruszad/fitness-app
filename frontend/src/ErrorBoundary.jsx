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
        <div className="center-state">
          <div className="center-panel card" role="alert">
            <span className="brand" aria-hidden="true"><span className="bar" /><span>FitAI</span></span>
            <h1 className="section-title">Something went wrong</h1>
            <p className="muted">An unexpected application error occurred. You can reload the page or navigate back.</p>
            {import.meta.env.DEV && <details className="disclosure error-details">
              <summary>Error details</summary>
              <pre className="disclosure-body">{this.state.error && this.state.error.toString()}{"\n"}{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
            </details>}
            <button type="button" onClick={() => window.location.reload()} className="btn btn--primary">
              Reload application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

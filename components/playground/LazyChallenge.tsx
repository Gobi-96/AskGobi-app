"use client";

import { Component, lazy, Suspense, type ReactNode } from "react";

// The import is requested only when the visitor opens a challenge. Curated play
// does not download the AI answer renderer or wait for a model connection.
const Challenge = lazy(() => import("./Challenge"));

class ChallengeBoundary extends Component<
  { children: ReactNode; onSurprise: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div>
          <p className="pg-error" role="alert">
            The challenge couldn’t load. Your connection may have dropped; the
            activities here still work.
          </p>
          <a className="pg-small-link" href="/?challenge=1">
            Reload the challenge
          </a>
          <div>
            <button
              className="pg-button pg-primary"
              onClick={this.props.onSurprise}
            >
              Back to surprises
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LazyChallenge(props: {
  onComplete: () => void;
  onSurprise: () => void;
}) {
  return (
    <ChallengeBoundary onSurprise={props.onSurprise}>
      <Suspense
        fallback={
          <div>
            <p className="pg-status" role="status">
              Opening the tiny AI challenge…
            </p>
            <button className="pg-small-link" onClick={props.onSurprise}>
              Back to surprises
            </button>
          </div>
        }
      >
        <Challenge {...props} />
      </Suspense>
    </ChallengeBoundary>
  );
}

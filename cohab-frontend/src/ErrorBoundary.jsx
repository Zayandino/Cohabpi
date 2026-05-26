import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary atrapó un error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: 'red', color: 'white', minHeight: '100vh', zIndex: 9999, position: 'relative' }}>
          <h1>¡La aplicación ha colapsado!</h1>
          <p>Se produjo un error crítico de React:</p>
          <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * ErrorBoundary de diagnóstico.
 * Em vez da página genérica do Next ("a client-side exception has occurred"),
 * mostra a mensagem e o stack do erro no ecrã — para conseguirmos ver a causa
 * sem depender da consola do browser.
 *
 * Usa estilos inline de propósito: se o erro for de tema/CSS, as classes
 * Tailwind podem não estar disponíveis, mas os estilos inline funcionam sempre.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Também vai para a consola, caso esteja a ser capturada
    console.error("[ErrorBoundary] Uncaught error:", error, info);
    this.setState({ componentStack: info.componentStack });
  }

  render() {
    const { error, componentStack } = this.state;

    if (!error) return this.props.children;

    // Em produção não expomos mensagem/stack/componente ao utilizador final
    // (pode revelar detalhes internos do servidor); o diagnóstico completo
    // fica reservado a ambientes não-produção.
    const isProduction = process.env.NODE_ENV === "production";

    return (
      <div
        style={{
          minHeight: "100vh",
          padding: "24px",
          background: "#fff",
          color: "#111",
          fontFamily: "monospace",
          fontSize: "13px",
          lineHeight: 1.5,
          overflow: "auto",
        }}
      >
        <h1 style={{ fontSize: "18px", marginBottom: "12px", color: "#b91c1c" }}>
          {isProduction ? "Ocorreu um erro na aplicação" : "Erro na aplicação (diagnóstico)"}
        </h1>

        {isProduction ? (
          <p style={{ marginBottom: "16px" }}>
            Pedimos desculpa pelo incómodo. Por favor recarregue a página; se o problema persistir, contacte o suporte.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: "16px" }}>
              <strong>Mensagem:</strong>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#f3f4f6",
                  padding: "12px",
                  borderRadius: "6px",
                  marginTop: "6px",
                }}
              >
                {error.name}: {error.message}
              </pre>
            </div>

            {error.stack && (
              <div style={{ marginBottom: "16px" }}>
                <strong>Stack:</strong>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f3f4f6",
                    padding: "12px",
                    borderRadius: "6px",
                    marginTop: "6px",
                  }}
                >
                  {error.stack}
                </pre>
              </div>
            )}

            {componentStack && (
              <div style={{ marginBottom: "16px" }}>
                <strong>Componente:</strong>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#f3f4f6",
                    padding: "12px",
                    borderRadius: "6px",
                    marginTop: "6px",
                  }}
                >
                  {componentStack}
                </pre>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "8px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;

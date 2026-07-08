import React from "react";

interface Props {
  children: React.ReactNode;
  /** Renderizado quando o children lança um erro. Recebe o erro para mostrar detalhe. */
  fallback: (error: Error) => React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Fronteira de erro para isolar o render de um item individual (ex.: um lead
 * numa lista). Se o render desse item falhar, mostra o fallback em vez de
 * derrubar a página inteira — e o fallback pode mostrar o erro/id do item,
 * o que permite diagnosticar sem acesso à máquina do utilizador.
 *
 * Usar com `key` único por item para que cada item tenha a sua própria
 * fronteira (e um item partido não afete os outros).
 */
export class RenderBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[RenderBoundary] Falha ao renderizar item:", error, info);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

export default RenderBoundary;

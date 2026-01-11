/**
 * Sistema de Tratamento de Erros Padronizado
 * 
 * Centraliza todo o error handling do sistema
 * Logs sanitizados e seguros (sem expor secrets)
 * 
 * @author Softgen AI
 * @date 2026-01-02
 */

import { PostgrestError } from "@supabase/supabase-js";

/**
 * Tipos de erros do sistema
 */
export enum ErrorType {
  AUTH = "AUTH_ERROR",
  VALIDATION = "VALIDATION_ERROR",
  DATABASE = "DATABASE_ERROR",
  NETWORK = "NETWORK_ERROR",
  PERMISSION = "PERMISSION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMIT = "RATE_LIMIT_ERROR",
  UNKNOWN = "UNKNOWN_ERROR",
}

/**
 * Classe de erro customizada para o sistema
 * 
 * Inclui tipo, status code e flag de erro operacional
 */
export class AppError extends Error {
  type: ErrorType;
  statusCode: number;
  isOperational: boolean;
  context?: Record<string, any>;

  constructor(
    type: ErrorType,
    message: string,
    statusCode = 500,
    context?: Record<string, any>
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.context = context;
    this.name = type;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Converte erro do Supabase/PostgreSQL para AppError
 * 
 * Mapeia códigos PostgreSQL para erros amigáveis
 * 
 * @param error - Erro do Supabase ou erro genérico
 * @returns AppError customizado
 */
export const handleSupabaseError = (
  error: PostgrestError | Error
): AppError => {
  // Erro com código PostgreSQL
  if ("code" in error) {
    const pgError = error as PostgrestError;

    // 23505: Unique violation (duplicado)
    if (pgError.code === "23505") {
      return new AppError(
        ErrorType.VALIDATION,
        "Este registo já existe. Por favor, use valores únicos.",
        400,
        { pgCode: pgError.code }
      );
    }

    // 23503: Foreign key violation (referência inválida)
    if (pgError.code === "23503") {
      return new AppError(
        ErrorType.VALIDATION,
        "Referência inválida. Verifique os dados relacionados.",
        400,
        { pgCode: pgError.code }
      );
    }

    // 42501: Insufficient privilege (sem permissão)
    if (pgError.code === "42501") {
      return new AppError(
        ErrorType.PERMISSION,
        "Não tem permissão para esta operação.",
        403,
        { pgCode: pgError.code }
      );
    }

    // 23502: Not null violation (campo obrigatório)
    if (pgError.code === "23502") {
      return new AppError(
        ErrorType.VALIDATION,
        "Campos obrigatórios não preenchidos.",
        400,
        { pgCode: pgError.code }
      );
    }

    // 23514: Check violation (validação de check constraint)
    if (pgError.code === "23514") {
      return new AppError(
        ErrorType.VALIDATION,
        "Valores inválidos. Verifique os dados inseridos.",
        400,
        { pgCode: pgError.code }
      );
    }
  }

  // Erro de rede
  if (error.message.includes("NetworkError") || error.message.includes("fetch")) {
    return new AppError(
      ErrorType.NETWORK,
      "Erro de conexão. Verifique sua internet e tente novamente.",
      503
    );
  }

  // Erro de autenticação
  if (error.message.includes("auth") || error.message.includes("session")) {
    return new AppError(
      ErrorType.AUTH,
      "Sessão expirada. Por favor, faça login novamente.",
      401
    );
  }

  // Erro genérico
  return new AppError(
    ErrorType.DATABASE,
    error.message || "Erro ao aceder à base de dados.",
    500
  );
};

/**
 * Sanitiza erro para logs (remove dados sensíveis)
 * 
 * Remove:
 * - Authorization headers
 * - API keys
 * - Tokens de acesso
 * - Senhas
 * - Dados pessoais sensíveis
 * 
 * @param error - Erro a sanitizar
 * @returns Erro sanitizado
 */
export const sanitizeError = (error: any): any => {
  if (!error) return error;

  const sanitized = { ...error };

  // Remover headers de autorização
  if (sanitized.config?.headers) {
    const headers = { ...sanitized.config.headers };
    delete headers.Authorization;
    delete headers.authorization;
    delete headers["X-API-Key"];
    delete headers["x-api-key"];
    sanitized.config.headers = headers;
  }

  // Remover tokens/keys dos dados
  if (sanitized.config?.data) {
    const data = { ...sanitized.config.data };
    delete data.apiKey;
    delete data.accessToken;
    delete data.refreshToken;
    delete data.password;
    delete data.secret;
    sanitized.config.data = data;
  }

  // Remover dados sensíveis do response
  if (sanitized.response?.data) {
    const responseData = { ...sanitized.response.data };
    delete responseData.password;
    delete responseData.token;
    delete responseData.secret;
    sanitized.response.data = responseData;
  }

  // Remover query parameters sensíveis
  if (sanitized.config?.params) {
    const params = { ...sanitized.config.params };
    delete params.apiKey;
    delete params.token;
    delete params.secret;
    sanitized.config.params = params;
  }

  return sanitized;
};

/**
 * Log de erro seguro
 * 
 * Sanitiza automaticamente dados sensíveis
 * Adiciona contexto e timestamp
 * 
 * Uso:
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logError(error as Error, 'riskyOperation');
 *   throw error;
 * }
 * ```
 * 
 * @param error - Erro a logar
 * @param context - Contexto onde o erro ocorreu
 */
export const logError = (error: Error | AppError, context?: string): void => {
  const sanitized = sanitizeError(error);

  const logEntry = {
    timestamp: new Date().toISOString(),
    context: context || "unknown",
    name: error.name,
    message: error.message,
    ...(error instanceof AppError && {
      type: error.type,
      statusCode: error.statusCode,
      context: error.context,
    }),
    stack: error.stack,
    sanitized,
  };

  // Log para console (desenvolvimento)
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context || "ERROR"}]`, logEntry);
  } else {
    // Log simplificado para produção
    console.error(`[${context || "ERROR"}]`, {
      timestamp: logEntry.timestamp,
      type: (error as AppError).type || "ERROR",
      message: error.message,
    });
  }

  // TODO: Enviar para serviço de logging externo (Sentry, LogRocket, etc.)
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(error, {
  //     extra: { context, sanitized },
  //   });
  // }
};

/**
 * Trata erro e retorna mensagem amigável para o utilizador
 * 
 * Uso:
 * ```typescript
 * try {
 *   await operation();
 * } catch (error) {
 *   const message = getUserFriendlyErrorMessage(error as Error);
 *   toast.error(message);
 * }
 * ```
 * 
 * @param error - Erro a processar
 * @returns Mensagem amigável para o utilizador
 */
export const getUserFriendlyErrorMessage = (
  error: Error | AppError
): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  // Mapear erros comuns para mensagens amigáveis
  if (error.message.includes("NetworkError") || error.message.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }

  if (error.message.includes("timeout")) {
    return "A operação demorou muito tempo. Tente novamente.";
  }

  if (error.message.includes("auth") || error.message.includes("session")) {
    return "Sessão expirada. Por favor, faça login novamente.";
  }

  if (error.message.includes("permission") || error.message.includes("forbidden")) {
    return "Não tem permissão para esta operação.";
  }

  // Mensagem genérica
  return "Ocorreu um erro. Por favor, tente novamente.";
};

/**
 * Cria erro de validação
 * 
 * Helper para criar erros de validação rapidamente
 * 
 * @param message - Mensagem de erro
 * @param field - Campo que falhou a validação (opcional)
 * @returns AppError de validação
 */
export const createValidationError = (
  message: string,
  field?: string
): AppError => {
  return new AppError(ErrorType.VALIDATION, message, 400, { field });
};

/**
 * Cria erro de permissão
 * 
 * Helper para criar erros de permissão rapidamente
 * 
 * @param message - Mensagem de erro
 * @returns AppError de permissão
 */
export const createPermissionError = (message?: string): AppError => {
  return new AppError(
    ErrorType.PERMISSION,
    message || "Não tem permissão para esta operação.",
    403
  );
};

/**
 * Cria erro de not found
 * 
 * Helper para criar erros 404 rapidamente
 * 
 * @param resource - Nome do recurso não encontrado
 * @returns AppError not found
 */
export const createNotFoundError = (resource: string): AppError => {
  return new AppError(
    ErrorType.NOT_FOUND,
    `${resource} não encontrado.`,
    404,
    { resource }
  );
};
import axios from "axios";
import { getPaymentConfig } from "@/lib/server/paymentConfig";

// URL de PRODUÇÃO e de SANDBOX da EuPago. A escolha depende do test_mode da
// config (Admin › Definições de Pagamento). Usar a chave de sandbox contra o
// URL de produção devolve 401 — daí escolhermos o URL certo por modo.
const EUPAGO_PROD_URL = "https://clientes.eupago.pt/api/v1.02";
const EUPAGO_SANDBOX_URL = "https://sandbox.eupago.pt/api/v1.02";

// Chave + URL base geridas em Admin › Definições de Pagamento (BD), fallback env.
const getEupago = async (): Promise<{ apiKey: string; baseUrl: string }> => {
  const { eupagoApiKey, testMode } = await getPaymentConfig();
  return {
    apiKey: eupagoApiKey || "",
    baseUrl: testMode ? EUPAGO_SANDBOX_URL : EUPAGO_PROD_URL,
  };
};

// A API REST v1.02 da EuPago autentica pelo cabeçalho Authorization: ApiKey.
// (Enviar só a `chave` no corpo — estilo antigo — devolve 401.)
const eupagoAuth = (apiKey: string) => ({
  headers: { Authorization: `ApiKey ${apiKey}`, "Content-Type": "application/json" },
});

export const eupago = {
  // Create MBWay payment
  createMBWayPayment: async ({
    amount,
    phone,
    reference,
    description,
  }: {
    amount: number;
    phone: string;
    reference: string;
    description: string;
  }) => {
    const { apiKey, baseUrl } = await getEupago();
    if (!apiKey) {
      throw new Error("Chave EuPago não configurada (Admin › Definições de Pagamento).");
    }

    try {
      const response = await axios.post(`${baseUrl}/mbway/create`, {
        chave: apiKey,
        valor: amount.toFixed(2),
        alias: phone,
        id: reference,
        descricao: description,
      }, eupagoAuth(apiKey));

      if (response.data.estado === "ok") {
        return {
          success: true,
          transactionId: response.data.transacao,
          reference: response.data.referencia,
          message: response.data.mensagem,
        };
      }
      throw new Error(response.data.mensagem || "Erro ao criar pagamento MBWay");
    } catch (error: any) {
      console.error("Error creating MBWay payment:", error?.response?.data || error.message);
      throw new Error(`Erro MBWay: ${error?.response?.data?.mensagem || error.message}`);
    }
  },

  // Create Multibanco reference
  createMultibancoReference: async ({
    amount,
    reference,
    description,
  }: {
    amount: number;
    reference: string;
    description: string;
  }) => {
    const { apiKey, baseUrl } = await getEupago();
    if (!apiKey) {
      throw new Error("Chave EuPago não configurada.");
    }

    try {
      const response = await axios.post(`${baseUrl}/multibanco/create`, {
        chave: apiKey,
        valor: amount.toFixed(2),
        id: reference,
        descricao: description,
      }, eupagoAuth(apiKey));

      if (response.data.estado === "ok") {
        return {
          success: true,
          entity: response.data.entidade,
          reference: response.data.referencia,
          amount: response.data.valor,
          expiryDate: response.data.data_fim,
        };
      }
      throw new Error(response.data.mensagem || "Erro ao criar referência Multibanco");
    } catch (error: any) {
      console.error("Error creating Multibanco reference:", error?.response?.data || error.message);
      throw new Error(`Erro Multibanco: ${error?.response?.data?.mensagem || error.message}`);
    }
  },

  // Create Credit Card payment (redirect flow — EuPago devolve um URL para onde
  // o cliente é encaminhado para introduzir os dados do cartão).
  createCreditCardPayment: async ({
    amount,
    reference,
    description,
    successUrl,
    failUrl,
  }: {
    amount: number;
    reference: string;
    description: string;
    successUrl: string;
    failUrl: string;
  }) => {
    const { apiKey, baseUrl } = await getEupago();
    if (!apiKey) {
      throw new Error("Chave EuPago não configurada.");
    }

    try {
      const response = await axios.post(`${baseUrl}/creditcard/create`, {
        chave: apiKey,
        valor: amount.toFixed(2),
        id: reference,
        descricao: description,
        url_retorno: successUrl,
        url_cancelamento: failUrl,
      }, eupagoAuth(apiKey));

      // A EuPago devolve o URL do formulário de cartão em `url` (ou `redirect`).
      const url = response.data.url || response.data.redirect || response.data.link;
      if (response.data.estado === "ok" && url) {
        return { success: true, url, reference: response.data.referencia };
      }
      throw new Error(response.data.mensagem || "Erro ao criar pagamento por cartão");
    } catch (error: any) {
      console.error("Error creating credit card payment:", error?.response?.data || error.message);
      throw new Error(`Erro cartão: ${error?.response?.data?.mensagem || error.message}`);
    }
  },

  // Check payment status
  checkPaymentStatus: async (reference: string) => {
    const { apiKey, baseUrl } = await getEupago();
    if (!apiKey) {
      throw new Error("Chave EuPago não configurada.");
    }

    try {
      const response = await axios.post(`${baseUrl}/pedido/info`, {
        chave: apiKey,
        referencia: reference,
      }, eupagoAuth(apiKey));

      return {
        status: response.data.estado,
        paid: response.data.estado === "Pago",
        amount: response.data.valor,
        paidDate: response.data.data_pagamento,
      };
    } catch (error: any) {
      console.error("Error checking payment status:", error?.response?.data || error.message);
      throw new Error(`Erro ao verificar status: ${error.message}`);
    }
  },
};

// Verify Eupago webhook signature (a EuPago usa a própria chave no payload)
export const verifyEupagoWebhook = async (payload: any, _signature: string): Promise<boolean> => {
  const { apiKey } = await getEupago();
  if (!apiKey) {
    throw new Error("Chave EuPago não configurada");
  }
  return payload.chave === apiKey;
};

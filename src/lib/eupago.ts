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

// Extrai o detalhe do erro da EuPago (corpo completo da resposta), para o erro
// não ficar apenas "Request failed with status code XXX".
const eupagoError = (error: any): string => {
  const data = error?.response?.data;
  if (data) return typeof data === "string" ? data : JSON.stringify(data);
  return error?.message || "erro desconhecido";
};

// A API REST v1.02 rejeita com {transactionStatus:"Rejected", code, text}. Lança
// com o código/detalhe reais em vez de um "erro genérico".
const throwIfRejected = (data: any) => {
  if (data && String(data.transactionStatus || "").toLowerCase() === "rejected") {
    throw new Error(data.text ? `${data.code || "Rejeitado"}: ${data.text}` : data.code || "Pagamento rejeitado");
  }
};

// Valor no formato da API REST (número, não string).
const toValue = (amount: number) => Number(Number(amount).toFixed(2));

export const eupago = {
  // Create MBWay payment (API REST v1.02: corpo ANINHADO com payment.amount e
  // customerPhone + countryCode — o formato antigo `alias` dava CUSTOMERPHONE_MISSING).
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

    // Telemóvel nacional (9 dígitos) + indicativo à parte, como a API espera.
    const nationalPhone = String(phone).replace(/\D/g, "").slice(-9);

    try {
      const response = await axios.post(`${baseUrl}/mbway/create`, {
        payment: {
          identifier: reference,
          amount: { value: toValue(amount), currency: "EUR" },
          customerPhone: nationalPhone,
          countryCode: "+351",
          description,
        },
      }, eupagoAuth(apiKey));

      const d = response.data || {};
      throwIfRejected(d);
      console.log("[eupago] MBWay create OK, keys:", Object.keys(d));
      return {
        success: true,
        transactionId: d.transactionID || d.transactionId || d.transacao || d.reference,
        reference: d.reference || d.referencia,
        message: d.text || d.mensagem || "Pagamento MBWay iniciado.",
      };
    } catch (error: any) {
      console.error("Error creating MBWay payment:", eupagoError(error));
      throw new Error(`Erro MBWay: ${eupagoError(error)}`);
    }
  },

  // Create Multibanco reference (API REST v1.02: corpo ANINHADO).
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
        payment: {
          identifier: reference,
          amount: { value: toValue(amount), currency: "EUR" },
          description,
        },
      }, eupagoAuth(apiKey));

      const d = response.data || {};
      throwIfRejected(d);
      console.log("[eupago] Multibanco create OK, keys:", Object.keys(d));
      return {
        success: true,
        entity: d.entity || d.entidade,
        reference: d.reference || d.referencia,
        amount: d.amount?.value ?? d.valor ?? amount,
        expiryDate: d.expirationDate || d.endDate || d.data_fim,
      };
    } catch (error: any) {
      console.error("Error creating Multibanco reference:", eupagoError(error));
      throw new Error(`Erro Multibanco: ${eupagoError(error)}`);
    }
  },

  // Create Credit Card payment (API REST v1.02: corpo ANINHADO; devolve um URL
  // para onde o cliente é encaminhado para introduzir os dados do cartão).
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
        payment: {
          identifier: reference,
          amount: { value: toValue(amount), currency: "EUR" },
          description,
          successUrl,
          failUrl,
          backUrl: failUrl,
        },
      }, eupagoAuth(apiKey));

      const d = response.data || {};
      throwIfRejected(d);
      console.log("[eupago] CreditCard create OK, keys:", Object.keys(d));
      const url = d.redirectUrl || d.url || d.redirect || d.link;
      if (!url) throw new Error("A EuPago não devolveu o URL do formulário de cartão.");
      return { success: true, url, reference: d.reference || d.referencia };
    } catch (error: any) {
      console.error("Error creating credit card payment:", eupagoError(error));
      throw new Error(`Erro cartão: ${eupagoError(error)}`);
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
      console.error("Error checking payment status:", eupagoError(error));
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

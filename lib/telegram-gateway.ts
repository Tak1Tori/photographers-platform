"server-only";

const gatewayApiBaseUrl = "https://gatewayapi.telegram.org";

type GatewayResponse<T> = {
  ok: boolean;
  result?: T;
  error?: string;
};

type GatewayRequestStatus = {
  request_id?: string;
  verification_status?: {
    status?: string;
  };
};

export type TelegramGatewayVerificationStatus =
  | "code_valid"
  | "code_invalid"
  | "code_max_attempts_exceeded"
  | "expired"
  | "pending";

function getGatewayToken() {
  const token = process.env.TELEGRAM_GATEWAY_TOKEN;
  if (!token) {
    throw new Error("Telegram Gateway is not configured.");
  }

  return token;
}

async function requestGateway<T>(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${gatewayApiBaseUrl}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGatewayToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  let body: GatewayResponse<T> | undefined;
  try {
    body = (await response.json()) as GatewayResponse<T>;
  } catch {
    // Do not include the response body in logs or errors: it may contain provider data.
  }

  if (!response.ok || !body?.ok || !body.result) {
    throw new Error("Telegram Gateway could not process the verification request.");
  }

  return body.result;
}

export async function sendTelegramGatewayVerification(phone: string) {
  const result = await requestGateway<GatewayRequestStatus>("sendVerificationMessage", {
    phone_number: phone,
    code_length: 6,
    ttl: 300
  });

  if (!result.request_id) {
    throw new Error("Telegram Gateway did not return a verification request.");
  }

  return { requestId: result.request_id };
}

export async function checkTelegramGatewayVerification(requestId: string, code: string) {
  const result = await requestGateway<GatewayRequestStatus>("checkVerificationStatus", {
    request_id: requestId,
    code
  });
  const status = result.verification_status?.status;

  if (status === "code_valid" || status === "code_invalid" || status === "code_max_attempts_exceeded" || status === "expired") {
    return status;
  }

  return "pending" as const;
}

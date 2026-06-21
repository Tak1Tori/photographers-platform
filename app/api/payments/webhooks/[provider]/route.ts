import { NextResponse } from "next/server";
import { parsePaymentProvider } from "@/lib/payments/providers";
import { handlePaymentWebhook } from "@/lib/payments/webhook-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { provider: string } }
) {
  try {
    const provider = parsePaymentProvider(params.provider);
    const result = await handlePaymentWebhook(provider, request);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid webhook request"
      },
      { status: 400 }
    );
  }
}

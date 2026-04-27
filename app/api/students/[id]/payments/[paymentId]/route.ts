import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { reviewPaymentRequest } from "@/lib/store";
import { sendTelegramPaymentNotification } from "@/lib/services/telegram-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok || !session) return jsonError(auth.ok ? "Session topilmadi." : auth.error, auth.ok ? 401 : auth.status);

  const { id, paymentId } = await params;
  const payload = (await request.json().catch(() => ({}))) as { status?: "approved" | "rejected"; note?: string };

  if (!payload.status || !["approved", "rejected"].includes(payload.status)) {
    return NextResponse.json({ error: "Payment status noto'g'ri." }, { status: 400 });
  }

  try {
    const student = await reviewPaymentRequest(id, paymentId, payload.status, session.id, payload.note);
    if (!student) {
      return NextResponse.json({ error: "Talaba yoki payment topilmadi." }, { status: 404 });
    }

    const payment = student.payments.find((item) => item.id === paymentId);
    if (payment) {
      void sendTelegramPaymentNotification({
        studentId: id,
        amount: payment.amount,
        status: payload.status,
        paidAt: payment.paidAt,
        month: payment.month,
        method: payment.method,
        transactionId: payment.transactionId,
        note: payload.note || payment.proofNote || payment.note,
      }).catch(() => {});
    }

    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment yangilanmadi." }, { status: 400 });
  }
}

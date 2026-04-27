import { NextResponse } from "next/server";
import { addPayment, requestStudentPayment } from "@/lib/store";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { canAccessStudent, requireRole } from "@/lib/services/auth-service";
import { sendTelegramPaymentNotification } from "@/lib/services/telegram-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  const { id } = await params;
  const payload = await request.json();

  if (!payload.amount || !payload.paidAt || !payload.method) {
    return NextResponse.json({ error: "To'lov maydonlari to'liq emas." }, { status: 400 });
  }

  if (session?.role === "student") {
    if (!canAccessStudent(session, id)) return jsonError("Bu student uchun to'lov yuborishga ruxsat yo'q.", 403);
    if (!payload.month) return NextResponse.json({ error: "To'lov oyi kiritilishi shart." }, { status: 400 });

    try {
      const student = await requestStudentPayment(id, {
        amount: Number(payload.amount),
        paidAt: payload.paidAt,
        method: payload.method,
        month: payload.month,
        note: payload.note,
        transactionId: payload.transactionId,
        proofNote: payload.proofNote,
      });

      if (!student) {
        return NextResponse.json({ error: "Talaba topilmadi." }, { status: 404 });
      }

      void sendTelegramPaymentNotification({
        studentId: id,
        amount: Number(payload.amount),
        status: "pending",
        paidAt: payload.paidAt,
        month: payload.month,
        method: payload.method,
        transactionId: payload.transactionId,
        note: payload.proofNote || payload.note,
      }).catch(() => {});

      return NextResponse.json(student, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "To'lov so'rovi yuborilmadi." }, { status: 400 });
    }
  }

  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  if (!session) return jsonError("Autentifikatsiya talab qilinadi.", 401);

  const student = await addPayment(id, {
    amount: Number(payload.amount),
    paidAt: payload.paidAt,
    method: payload.method,
    month: payload.month,
    note: payload.note,
    transactionId: payload.transactionId,
    proofNote: payload.proofNote,
    actorUserId: session.id,
  });

  if (!student) {
    return NextResponse.json({ error: "Talaba topilmadi." }, { status: 404 });
  }

  void sendTelegramPaymentNotification({
    studentId: id,
    amount: Number(payload.amount),
    status: "approved",
    paidAt: payload.paidAt,
    month: payload.month,
    method: payload.method,
    transactionId: payload.transactionId,
    note: payload.proofNote || payload.note,
  }).catch(() => {});

  return NextResponse.json(student, { status: 201 });
}

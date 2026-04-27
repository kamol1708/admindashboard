export interface StudentModel {
  id: string;
  fullName: string;
  group: string;
  phone: string;
  parentPhone: string;
  joinedAt: string;
  status: "active" | "warning" | "probation" | "removed";
  balance: number;
  notes: string;
  grades: Array<{
    id: string;
    subject: string;
    score: number;
    maxScore: number;
    examDate: string;
    note?: string;
  }>;
  attendance: Array<{
    id: string;
    date: string;
    status: "present" | "late" | "absent";
    lesson: string;
    topic?: string;
    homework?: number;
    comment?: string;
    reason?: "sick" | "permission" | "no_reason";
    earlyLeave?: boolean;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    method: "cash" | "card" | "transfer";
    status?: "pending" | "approved" | "rejected";
    month?: string;
    requestedAt?: string;
    confirmedAt?: string;
    transactionId?: string;
    proofNote?: string;
    reviewedByUserId?: string;
    note?: string;
  }>;
  telegram?: {
    chatId?: string;
    username?: string;
    connectedAt?: string;
    inviteToken?: string;
    inviteExpiresAt?: string;
    inviteSentAt?: string;
    credentialsSentAt?: string;
  };
}

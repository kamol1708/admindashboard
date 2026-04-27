export function billingStatusLabel(status: "paid" | "partial" | "unpaid" | "overdue") {
  if (status === "paid") return "To'langan";
  if (status === "partial") return "Qisman to'lagan";
  if (status === "overdue") return "Muddati o'tgan";
  return "To'lanmagan";
}

export function billingStatusTone(status: "paid" | "partial" | "unpaid" | "overdue") {
  if (status === "paid") return "bg-emerald-500/15 text-emerald-300";
  if (status === "partial") return "bg-sky-500/15 text-sky-300";
  if (status === "overdue") return "bg-amber-500/15 text-amber-300";
  return "bg-rose-500/15 text-rose-300";
}

export function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("uz-UZ").format(value)} so'm`;
}

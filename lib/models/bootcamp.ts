export interface BootcampModel {
  id: string;
  name: string;
  price: number;
}

export interface EnrollmentModel {
  id: string;
  studentId: string;
  bootcampId: string;
  paymentAmount: number;
  paymentStatus: "paid" | "unpaid" | "partial";
  startDate: string;
}

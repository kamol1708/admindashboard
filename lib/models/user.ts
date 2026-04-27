export type UserRoleModel = "admin" | "teacher" | "student";

export interface UserModel {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: UserRoleModel;
  linkedStudentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

import { randomUUID } from "crypto";
import { User } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { ConflictError, NotFoundError } from "../../domain/errors/DomainError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { hashPassword } from "../../infrastructure/auth/password";

export async function createEmployeeAccount(
  users: UserRepository,
  input: { name: string; email: string; password: string },
): Promise<User> {
  const email = input.email.toLowerCase();
  if (await users.findByEmail(email)) {
    throw new ConflictError("An account with this email already exists");
  }
  return users.create({
    id: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    role: UserRole.EMPLOYEE,
    active: true,
    emailVerified: true,
    successRewardInr: 0,
  });
}

export async function requireActiveEmployee(users: UserRepository, employeeId: string): Promise<User> {
  const employee = await users.findById(employeeId);
  if (!employee || employee.role !== UserRole.EMPLOYEE || !employee.active) {
    throw new NotFoundError("Choose an active employee");
  }
  return employee;
}

export async function deleteEmployeeAccount(users: UserRepository, userId: string): Promise<void> {
  const user = await users.findById(userId);
  if (!user || user.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  await users.delete(user.id);
}

export async function changeEmployeePassword(users: UserRepository, userId: string, password: string): Promise<void> {
  const user = await users.findById(userId);
  if (!user || user.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  await users.update({ ...user, passwordHash: await hashPassword(password) });
}

export async function setEmployeeReward(users: UserRepository, userId: string, successRewardInr: number): Promise<User> {
  const user = await users.findById(userId);
  if (!user || user.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  return users.update({ ...user, successRewardInr });
}

export async function setEmployeeActive(users: UserRepository, userId: string, active: boolean): Promise<User> {
  const user = await users.findById(userId);
  if (!user || user.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  return users.update({ ...user, active });
}

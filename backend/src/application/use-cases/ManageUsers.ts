import { randomUUID } from "crypto";
import { User } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { ConflictError, NotFoundError } from "../../domain/errors/DomainError";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { hashPassword } from "../../infrastructure/auth/password";

export const DEFAULT_SUCCESS_REWARD_INR = 40;

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
    successRewardInr: DEFAULT_SUCCESS_REWARD_INR,
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

export async function setEmployeeRewards(
  users: UserRepository,
  successRewardInr: number,
  target: { all: boolean; employeeIds: string[] },
): Promise<number> {
  const employees = target.all
    ? await users.listByRole(UserRole.EMPLOYEE)
    : (
        await Promise.all(target.employeeIds.map((id) => users.findById(id)))
      ).filter((user): user is User => user?.role === UserRole.EMPLOYEE);
  for (const employee of employees) {
    await users.update({ ...employee, successRewardInr });
  }
  return employees.length;
}

export async function deleteEmployeeAccounts(
  users: UserRepository,
  target: { inactive: boolean; employeeIds: string[] },
): Promise<number> {
  const employees = await users.listByRole(UserRole.EMPLOYEE);
  const chosen = target.inactive
    ? employees.filter((employee) => employee.active === false)
    : employees.filter((employee) => target.employeeIds.includes(employee.id));
  for (const employee of chosen) {
    await users.delete(employee.id);
  }
  return chosen.length;
}

export async function setEmployeeActive(users: UserRepository, userId: string, active: boolean): Promise<User> {
  const user = await users.findById(userId);
  if (!user || user.role !== UserRole.EMPLOYEE) {
    throw new NotFoundError("Employee not found");
  }
  return users.update({ ...user, active });
}

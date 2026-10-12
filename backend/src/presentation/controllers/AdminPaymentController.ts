import { NextFunction, Request, Response } from "express";
import { toPublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { toPaymentDto } from "../../application/dto/payment.dto";
import { PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import {
  changeEmployeePassword,
  createEmployeeAccount,
  deleteEmployeeAccount,
  setEmployeeActive,
  setEmployeeReward,
} from "../../application/use-cases/ManageUsers";
import {
  assignPaymentSession,
  cancelPaymentSession,
  getAdminPayments,
} from "../../application/use-cases/PaymentQueries";
import { logger } from "../../shared/logger/logger";
import {
  adminQuerySchema,
  assignSchema,
  createEmployeeSchema,
  employeeActiveSchema,
  employeeListSchema,
  employeePasswordSchema,
  employeeRewardSchema,
} from "../validation";

export function createAdminPaymentController(deps: PaymentUseCaseDeps & { users: UserRepository }) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const query = adminQuerySchema.parse(req.query);
        const payments = await getAdminPayments(deps, {
          status: query.status,
          employeeId: query.employeeId,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
          scope: query.scope,
        });
        res.json({ payments });
      } catch (error) {
        next(error);
      }
    },

    async createEmployee(req: Request, res: Response, next: NextFunction) {
      try {
        const body = createEmployeeSchema.parse(req.body);
        const created = await createEmployeeAccount(deps.users, body);
        logger.info("employee created", { employeeId: created.id });
        res.status(201).json({ employee: toPublicUser(created) });
      } catch (error) {
        next(error);
      }
    },

    async setActive(req: Request, res: Response, next: NextFunction) {
      try {
        const body = employeeActiveSchema.parse(req.body);
        const saved = await setEmployeeActive(deps.users, req.params.id, body.active);
        logger.info("employee active changed", { employeeId: saved.id, active: saved.active });
        res.json({ employee: toPublicUser(saved) });
      } catch (error) {
        next(error);
      }
    },

    async setReward(req: Request, res: Response, next: NextFunction) {
      try {
        const body = employeeRewardSchema.parse(req.body);
        const saved = await setEmployeeReward(deps.users, req.params.id, body.successRewardInr);
        logger.info("employee success reward changed", {
          employeeId: saved.id,
          successRewardInr: saved.successRewardInr ?? 0,
        });
        res.json({ employee: toPublicUser(saved) });
      } catch (error) {
        next(error);
      }
    },

    async setPassword(req: Request, res: Response, next: NextFunction) {
      try {
        const body = employeePasswordSchema.parse(req.body);
        await changeEmployeePassword(deps.users, req.params.id, body.password);
        logger.info("employee password changed", { employeeId: req.params.id });
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    async removeEmployee(req: Request, res: Response, next: NextFunction) {
      try {
        await deleteEmployeeAccount(deps.users, req.params.id);
        logger.info("employee deleted", { employeeId: req.params.id });
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    async employees(req: Request, res: Response, next: NextFunction) {
      try {
        const query = employeeListSchema.parse(req.query);
        if (query.limit === undefined) {
          const users = await deps.users.listByRole(UserRole.EMPLOYEE);
          res.json({ employees: users.map(toPublicUser) });
          return;
        }
        const offset = query.offset ?? 0;
        const page = await deps.users.listByRolePage(UserRole.EMPLOYEE, offset, query.limit);
        res.json({
          employees: page.users.map(toPublicUser),
          total: page.total,
          activeCount: page.activeCount,
          hasMore: offset + page.users.length < page.total,
        });
      } catch (error) {
        next(error);
      }
    },

    async assign(req: Request, res: Response, next: NextFunction) {
      try {
        const body = assignSchema.parse(req.body);
        const saved = await assignPaymentSession(deps, req.params.id, body.employeeId);
        logger.info("payment assigned", {
          paymentSessionId: saved.id,
          employeeId: saved.assignedEmployeeId,
          status: saved.status,
        });
        res.json({ payment: toPaymentDto(saved) });
      } catch (error) {
        next(error);
      }
    },

    async cancel(req: Request, res: Response, next: NextFunction) {
      try {
        const saved = await cancelPaymentSession(deps, req.params.id);
        logger.info("payment failed", {
          paymentSessionId: saved.id,
          status: saved.status,
        });
        res.json({ payment: toPaymentDto(saved) });
      } catch (error) {
        next(error);
      }
    },
  };
}

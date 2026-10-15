import { NextFunction, Request, Response } from "express";
import { rewardInr, toPublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { getAdminPayoutReport, markEmployeePaid, markEmployeeUnpaid } from "../../application/use-cases/EmployeeAccounts";
import { toPaymentDto } from "../../application/dto/payment.dto";
import { PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import {
  changeEmployeePassword,
  createEmployeeAccount,
  deleteEmployeeAccount,
  deleteEmployeeAccounts,
  setEmployeeActive,
  setEmployeeReward,
  setEmployeeRewards,
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
  payoutListSchema,
  bulkDeleteSchema,
  bulkRewardSchema,
  employeePasswordSchema,
  employeeRewardSchema,
} from "../validation";

export function createAdminPaymentController(deps: PaymentUseCaseDeps & { users: UserRepository }) {
  return {
    async payouts(req: Request, res: Response, next: NextFunction) {
      try {
        const query = payoutListSchema.parse(req.query);
        res.json(
          await getAdminPayoutReport(deps.users, deps.payments, deps.now(), {
            offset: query.offset ?? 0,
            limit: query.limit ?? 8,
            q: query.q,
            unpaidOnly: query.unpaid,
          }),
        );
      } catch (error) {
        next(error);
      }
    },

    async payoutQr(req: Request, res: Response, next: NextFunction) {
      try {
        const qrImage = await deps.users.getPayoutQr(req.params.id);
        if (!qrImage) {
          res.status(404).json({ error: "No payment QR uploaded" });
          return;
        }
        res.setHeader("Cache-Control", "no-store");
        res.json({ qrImage });
      } catch (error) {
        next(error);
      }
    },

    async markPaid(req: Request, res: Response, next: NextFunction) {
      try {
        const employee = await markEmployeePaid(deps.users, deps.payments, req.params.id, deps.now());
        await publishPayout(deps, employee.id);
        logger.info("employee marked paid", { employeeId: employee.id, paidInr: employee.paidInr });
        res.json({ employee: toPublicUser(employee) });
      } catch (error) {
        next(error);
      }
    },

    async markUnpaid(req: Request, res: Response, next: NextFunction) {
      try {
        const employee = await markEmployeeUnpaid(deps.users, req.params.id);
        await publishPayout(deps, employee.id);
        logger.info("employee marked unpaid", { employeeId: employee.id, paidInr: employee.paidInr });
        res.json({ employee: toPublicUser(employee) });
      } catch (error) {
        next(error);
      }
    },

    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const query = adminQuerySchema.parse(req.query);
        const filter = {
          status: query.status,
          employeeId: query.employeeId,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
          scope: query.scope,
          q: query.q,
        };
        const page =
          query.limit === undefined ? undefined : { offset: query.offset ?? 0, limit: query.limit };
        const result = await getAdminPayments(deps, filter, page);
        res.json(result);
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

    async setRewards(req: Request, res: Response, next: NextFunction) {
      try {
        const body = bulkRewardSchema.parse(req.body);
        const updated = await setEmployeeRewards(deps.users, body.successRewardInr, {
          all: body.all === true,
          employeeIds: body.employeeIds ?? [],
        });
        logger.info("employee rewards updated", { updated, successRewardInr: body.successRewardInr, all: body.all === true });
        res.json({ updated, successRewardInr: body.successRewardInr });
      } catch (error) {
        next(error);
      }
    },

    async removeEmployees(req: Request, res: Response, next: NextFunction) {
      try {
        const body = bulkDeleteSchema.parse(req.body);
        const deleted = await deleteEmployeeAccounts(deps.users, {
          inactive: body.inactive === true,
          employeeIds: body.employeeIds ?? [],
        });
        logger.info("employees deleted", { deleted, inactive: body.inactive === true });
        res.json({ deleted });
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
        const page = await deps.users.listByRolePage(UserRole.EMPLOYEE, offset, query.limit, query.q);
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

async function publishPayout(deps: PaymentUseCaseDeps & { users: UserRepository }, employeeId: string) {
  const employee = await deps.users.findById(employeeId);
  if (!employee) {
    return;
  }
  const counts = await deps.payments.countOutcomes(employeeId);
  const earnedInr = counts.passed * rewardInr(employee.successRewardInr);
  const paidInr = rewardInr(employee.paidInr);
  deps.events.publish({
    type: "payout-updated",
    data: { employeeId, paidInr, earnedInr, unpaidInr: Math.max(0, earnedInr - paidInr) },
  });
}

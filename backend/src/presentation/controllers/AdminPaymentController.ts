import { NextFunction, Request, Response } from "express";
import { rewardInr, toPublicUser } from "../../domain/entities/User";
import { UserRole } from "../../domain/enums/UserRole";
import { BroadcastRepository } from "../../domain/repositories/BroadcastRepository";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { publishBroadcast as createBroadcast, stopBroadcast as endBroadcast } from "../../application/use-cases/Broadcasts";
import {
  clearEmployeePause,
  defaultStatisticsRange,
  getAdminPayoutReport,
  getAdminStatistics,
  getExtensionUserStats,
  markExtensionUserPaid,
  startOfTodayIst,
  markEmployeePaid,
  markEmployeeUnpaid,
  parseIstDate,
} from "../../application/use-cases/EmployeeAccounts";
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
  statisticsQuerySchema,
  bulkDeleteSchema,
  bulkRewardSchema,
  employeePasswordSchema,
  employeeRewardSchema,
  broadcastSchema,
  extensionPaidSchema,
} from "../validation";

export function createAdminPaymentController(
  deps: PaymentUseCaseDeps & { users: UserRepository; broadcasts: BroadcastRepository },
) {
  return {
    async publishBroadcast(req: Request, res: Response, next: NextFunction) {
      try {
        const body = broadcastSchema.parse(req.body);
        const broadcast = await createBroadcast(deps.broadcasts, deps.events, {
          message: body.message,
          durationMinutes: body.durationMinutes,
          createdByUserId: req.user!.id,
          now: deps.now(),
        });
        res.status(201).json({ broadcast });
      } catch (error) {
        next(error);
      }
    },

    async stopBroadcast(req: Request, res: Response, next: NextFunction) {
      try {
        await endBroadcast(deps.broadcasts, deps.events, String(req.params.id), deps.now());
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },

    async statistics(req: Request, res: Response, next: NextFunction) {
      try {
        const query = statisticsQuerySchema.parse(req.query);
        const fallback = defaultStatisticsRange(deps.now());
        const from = query.from ? parseIstDate(query.from) : fallback.from;
        const toDay = query.to ? parseIstDate(query.to) : new Date(fallback.to.getTime() - 24 * 60 * 60 * 1000);
        if (Number.isNaN(from.getTime()) || Number.isNaN(toDay.getTime()) || from.getTime() > toDay.getTime()) {
          res.status(400).json({ error: "Choose a valid date range" });
          return;
        }
        res.json(await getAdminStatistics(deps.users, deps.payments, from, new Date(toDay.getTime() + 24 * 60 * 60 * 1000)));
      } catch (error) {
        next(error);
      }
    },

    async extensionUsers(req: Request, res: Response, next: NextFunction) {
      try {
        const range = extensionRange(req, deps.now());
        if (!range) {
          res.status(400).json({ error: "Choose a valid date range" });
          return;
        }
        res.json(await getExtensionUserStats(deps.users, deps.payments, range));
      } catch (error) {
        next(error);
      }
    },

    async markExtensionPaid(req: Request, res: Response, next: NextFunction) {
      try {
        const body = extensionPaidSchema.parse(req.body);
        const range = inclusiveIstRange(body.from, body.to);
        if (!range) {
          res.status(400).json({ error: "Choose a valid date range" });
          return;
        }
        const saved = await markExtensionUserPaid(deps.users, deps.payments, String(req.params.id), range, deps.now());
        res.json({ paidInr: saved.paidInr ?? 0 });
      } catch (error) {
        next(error);
      }
    },

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

    async clearPause(req: Request, res: Response, next: NextFunction) {
      try {
        const saved = await clearEmployeePause(deps.users, req.params.id, deps.now());
        deps.events.publish({ type: "pause-cleared", data: { employeeId: saved.id } });
        logger.info("employee pause cleared", { employeeId: saved.id });
        res.json({ employee: toPublicUser(saved) });
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

function extensionRange(req: Request, now: Date): { from: Date; to: Date } | null {
  const query = statisticsQuerySchema.parse(req.query);
  const today = formatDay(startOfTodayIst(now));
  return inclusiveIstRange(query.from ?? today, query.to ?? today);
}

function inclusiveIstRange(fromDay: string, toDay: string): { from: Date; to: Date } | null {
  const from = parseIstDate(fromDay);
  const to = parseIstDate(toDay);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) {
    return null;
  }
  return { from, to: new Date(to.getTime() + 24 * 60 * 60 * 1000) };
}

function formatDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

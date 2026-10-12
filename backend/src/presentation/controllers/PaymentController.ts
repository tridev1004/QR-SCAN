import { NextFunction, Request, Response } from "express";
import { toPaymentDto } from "../../application/dto/payment.dto";
import { createPaymentSession, PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import { requireActiveEmployee } from "../../application/use-cases/ManageUsers";
import {
  getEmployeePayments,
  getPaymentQr,
  getPaymentSession,
  recordHeartbeat,
  summarizeEmployeeEarnings,
} from "../../application/use-cases/PaymentQueries";
import { updatePaymentStatus } from "../../application/use-cases/UpdatePaymentStatus";
import { rewardInr } from "../../domain/entities/User";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PaymentSseService } from "../../infrastructure/realtime/PaymentSseService";
import { logger } from "../../shared/logger/logger";
import { createPaymentSchema, heartbeatSchema, statusSchema } from "../validation";

export function createPaymentController(deps: PaymentUseCaseDeps & { users: UserRepository }, sse: PaymentSseService) {
  return {
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const body = createPaymentSchema.parse(req.body);
        const expiresAt = new Date(body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
          res.status(400).json({ error: "Invalid expiry" });
          return;
        }
        const employee = await requireActiveEmployee(deps.users, body.assignedEmployeeId);
        const result = await createPaymentSession(deps, {
          localSessionId: body.localSessionId,
          assignedEmployeeId: employee.id,
          qrFingerprint: body.qrFingerprint,
          qrImage: body.qrImage,
          expiresAt,
          createdByUserId: req.user!.id,
        });
        logger.info(result.created ? "payment session created" : "payment session reused", {
          paymentSessionId: result.session.id,
          status: result.session.status,
        });
        res.status(result.created ? 201 : 200).json({
          paymentSessionId: result.session.id,
          code: result.session.code,
          status: result.session.status,
        });
      } catch (error) {
        next(error);
      }
    },

    async updateStatus(req: Request, res: Response, next: NextFunction) {
      try {
        const body = statusSchema.parse(req.body);
        const saved = await updatePaymentStatus(deps, req.params.id, body.status, body.errorMessage);
        logger.info("payment status updated", {
          paymentSessionId: saved.id,
          status: saved.status,
        });
        res.json({ paymentSessionId: saved.id, status: saved.status });
      } catch (error) {
        next(error);
      }
    },

    async heartbeat(req: Request, res: Response, next: NextFunction) {
      try {
        const body = heartbeatSchema.parse(req.body);
        await recordHeartbeat(deps, body.paymentSessionIds);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    async listMine(req: Request, res: Response, next: NextFunction) {
      try {
        const employee = await deps.users.findById(req.user!.id);
        const payments = await getEmployeePayments(deps, req.user!.id);
        res.json({
          payments,
          earnings: summarizeEmployeeEarnings(payments, rewardInr(employee?.successRewardInr)),
        });
      } catch (error) {
        next(error);
      }
    },

    async getOne(req: Request, res: Response, next: NextFunction) {
      try {
        const session = await getPaymentSession(deps, req.user!, req.params.id);
        res.json({ payment: toPaymentDto(session) });
      } catch (error) {
        next(error);
      }
    },

    async getQr(req: Request, res: Response, next: NextFunction) {
      try {
        const qrImage = await getPaymentQr(deps, req.user!, req.params.id);
        if (!qrImage) {
          res.status(404).json({ error: "QR is no longer available" });
          return;
        }
        res.json({ qrImage });
      } catch (error) {
        next(error);
      }
    },

    events(req: Request, res: Response, paymentSessionId?: string) {
      sse.connect(req.user!, res, paymentSessionId);
    },
  };
}

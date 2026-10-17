import { NextFunction, Request, Response } from "express";
import { toPaymentDto } from "../../application/dto/payment.dto";
import { createPaymentSession, PaymentUseCaseDeps } from "../../application/use-cases/CreatePaymentSession";
import { requireActiveEmployee } from "../../application/use-cases/ManageUsers";
import {
  getEmployeeDashboard,
  getPaymentQr,
  getPaymentSession,
  recordHeartbeat,
  reservePaymentSession,
} from "../../application/use-cases/PaymentQueries";
import { updatePaymentStatus } from "../../application/use-cases/UpdatePaymentStatus";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { PaymentSseService } from "../../infrastructure/realtime/PaymentSseService";
import { logger } from "../../shared/logger/logger";
import { listActiveBroadcasts } from "../../application/use-cases/Broadcasts";
import { BroadcastRepository } from "../../domain/repositories/BroadcastRepository";
import { saveEmployeePayoutQr, saveEmployeeUpiId } from "../../application/use-cases/EmployeeAccounts";
import { createPaymentSchema, heartbeatSchema, paymentListSchema, payoutQrSchema, payoutUpiSchema, statusSchema } from "../validation";

export function createPaymentController(
  deps: PaymentUseCaseDeps & { users: UserRepository; broadcasts?: BroadcastRepository },
  sse: PaymentSseService,
) {
  return {
    async broadcasts(_req: Request, res: Response, next: NextFunction) {
      try {
        if (!deps.broadcasts) {
          res.status(500).json({ error: "Broadcasts are not configured" });
          return;
        }
        res.json({ broadcasts: await listActiveBroadcasts(deps.broadcasts, deps.now()) });
      } catch (error) {
        next(error);
      }
    },

    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const body = createPaymentSchema.parse(req.body);
        const expiresAt = new Date(body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
          res.status(400).json({ error: "Invalid expiry" });
          return;
        }
        const broadcast = body.broadcast === true;
        const employee = broadcast ? null : await requireActiveEmployee(deps.users, body.assignedEmployeeId ?? "");
        const result = await createPaymentSession(deps, {
          localSessionId: body.localSessionId,
          assignedEmployeeId: employee?.id,
          broadcast,
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
        const query = paymentListSchema.parse(req.query);
        const employee = await deps.users.findById(req.user!.id);
        const dashboard = await getEmployeeDashboard(deps, employee, {
          offset: query.offset ?? 0,
          limit: query.limit ?? 8,
          q: query.q,
        });
        res.json(dashboard);
      } catch (error) {
        next(error);
      }
    },

    async ownPayout(req: Request, res: Response, next: NextFunction) {
      try {
        const [employee, qrImage] = await Promise.all([
          deps.users.findById(req.user!.id),
          deps.users.getPayoutQr(req.user!.id),
        ]);
        res.setHeader("Cache-Control", "no-store");
        res.json({ qrImage, upiId: employee?.upiId ?? "" });
      } catch (error) {
        next(error);
      }
    },

    async saveUpiId(req: Request, res: Response, next: NextFunction) {
      try {
        const body = payoutUpiSchema.parse(req.body);
        await saveEmployeeUpiId(deps.users, req.user!.id, body.upiId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    async uploadPayoutQr(req: Request, res: Response, next: NextFunction) {
      try {
        const body = payoutQrSchema.parse(req.body);
        await saveEmployeePayoutQr(deps.users, req.user!.id, body.qrImage);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },

    async ownPayoutQr(req: Request, res: Response, next: NextFunction) {
      try {
        const qrImage = await deps.users.getPayoutQr(req.user!.id);
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

    async getOne(req: Request, res: Response, next: NextFunction) {
      try {
        const session = await getPaymentSession(deps, req.user!, req.params.id);
        res.json({ payment: toPaymentDto(session) });
      } catch (error) {
        next(error);
      }
    },

    async reserve(req: Request, res: Response, next: NextFunction) {
      try {
        const saved = await reservePaymentSession(deps, req.params.id, req.user!.id);
        res.json({ payment: toPaymentDto(saved) });
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

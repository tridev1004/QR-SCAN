import jwt, { SignOptions } from "jsonwebtoken";
import { PublicUser } from "../../domain/entities/User";

export interface TokenService {
  sign(user: PublicUser): string;
  verify(token: string): { userId: string } | null;
}

export function createTokenService(secret: string, expiresIn: string): TokenService {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return {
    sign(user) {
      return jwt.sign({ sub: user.id }, secret, options);
    },
    verify(token) {
      try {
        const payload = jwt.verify(token, secret);
        if (typeof payload === "string" || typeof payload.sub !== "string") {
          return null;
        }
        return { userId: payload.sub };
      } catch {
        return null;
      }
    },
  };
}

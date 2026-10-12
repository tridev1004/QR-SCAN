export interface VerificationEmail {
  to: string;
  name: string;
  verifyUrl: string;
}

export interface Mailer {
  sendVerification(message: VerificationEmail): Promise<void>;
}

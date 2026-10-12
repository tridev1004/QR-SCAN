function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function verificationEmailHtml(name: string, verifyUrl: string): string {
  const safeName = escapeHtml(name.trim() || "there");
  const safeUrl = escapeHtml(verifyUrl);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f0e8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf8;border:1px solid #e3dacd;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#0c3f3b;padding:28px 32px;">
                <p style="margin:0;font-family:Georgia, 'Times New Roman', serif;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#d7ebe4;">UPI QR Monitor</p>
                <h1 style="margin:10px 0 0;font-family:Georgia, 'Times New Roman', serif;font-size:28px;line-height:1.25;font-weight:normal;color:#fffdf8;">Confirm your account</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:'Segoe UI', Helvetica, Arial, sans-serif;color:#1d1a16;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hello ${safeName},</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#5c5346;">Use the button below to confirm this email and open your employee account. The link expires in 24 hours.</p>
                <a href="${safeUrl}" style="display:inline-block;background:#0f5c56;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">Confirm email</a>
                <p style="margin:28px 0 8px;font-size:13px;line-height:1.5;color:#6f675e;">If the button does not open, copy this address into your browser:</p>
                <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:#0c3f3b;">${safeUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;font-family:'Segoe UI', Helvetica, Arial, sans-serif;font-size:12px;line-height:1.5;color:#8a8176;">
                If you did not create this account, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

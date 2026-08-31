/* Sending the OTP.
   With no provider key configured this runs in DEMO mode: the code comes
   back to the browser and is shown on screen. Fill in MSG91 or Fast2SMS
   in .env and real texts go out instead — nothing else in the app changes. */

const MSG91_KEY = () => process.env.MSG91_AUTH_KEY;
const MSG91_TPL = () => process.env.MSG91_TEMPLATE_ID;
const FAST2SMS_KEY = () => process.env.FAST2SMS_API_KEY;

export function smsMode() {
  if (MSG91_KEY() && MSG91_TPL()) return "msg91";
  if (FAST2SMS_KEY()) return "fast2sms";
  return "demo";
}

/** Returns { sent: boolean, demoCode?: string }. Throws on provider failure. */
export async function sendOtpSms(phone, code) {
  const mode = smsMode();

  if (mode === "msg91") {
    const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(MSG91_TPL())}` +
                `&mobile=91${phone}&otp=${code}`;
    const res = await fetch(url, { method: "POST", headers: { authkey: MSG91_KEY() } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.type === "error") {
      throw new Error("MSG91 refused the request: " + (body.message || res.status));
    }
    return { sent: true };
  }

  if (mode === "fast2sms") {
    const url = "https://www.fast2sms.com/dev/bulkV2?" + new URLSearchParams({
      authorization: FAST2SMS_KEY(),
      route: "otp",
      variables_values: code,
      numbers: phone,
    });
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.return === false) {
      throw new Error("Fast2SMS refused the request: " + (body.message || res.status));
    }
    return { sent: true };
  }

  // Demo mode — no SMS leaves the server.
  return { sent: false, demoCode: code };
}

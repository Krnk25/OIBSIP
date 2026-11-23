export const sendDeliveryOtpSms = async (phone10, otp, orderId) => {
  if (!phone10) {
    return { sent: false, reason: "Customer phone number not found" };
  }

  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log(`[DEV SMS] Order #${String(orderId).slice(-6)} -> +91${phone10} | OTP: ${otp}`);
    return { sent: false, reason: "FAST2SMS_API_KEY missing (logged to console)" };
  }

  const message = `PizzaZone Delivery OTP for Order #${String(orderId)
    .slice(-6)
    .toUpperCase()} is ${otp}. Share this code with delivery partner upon arrival.`;

  const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(
    apiKey
  )}&route=q&message=${encodeURIComponent(message)}&language=english&flash=0&numbers=${phone10}`;

  const response = await fetch(url, { method: "GET" });
  const data = await response.json();

  if (!response.ok || data.return === false) {
    throw new Error(data.message || "SMS gateway failed");
  }

  return { sent: true, provider: "fast2sms", data };
};
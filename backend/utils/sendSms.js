const normalizeIndianPhone10 = (rawPhone) => {
  if (!rawPhone) return "";
  const digits = String(rawPhone).replace(/\D/g, "");
  const tenDigits = digits.length >= 10 ? digits.slice(-10) : "";
  return /^[6-9]\d{9}$/.test(tenDigits) ? tenDigits : "";
};

export const sendDeliveryOtpSms = async (phone10, otp, orderId) => {
  const cleanPhone = normalizeIndianPhone10(phone10);
  if (!cleanPhone) {
    return {
      sent: false,
      reason: "Valid 10-digit Indian mobile number not found",
    };
  }

  const cleanOtp = String(otp || "").trim();
  if (!cleanOtp) {
    return { sent: false, reason: "Delivery OTP is missing" };
  }

  const shortOrderId = String(orderId || "")
    .slice(-6)
    .toUpperCase();

  const apiKey = String(process.env.FAST2SMS_API_KEY || "").trim();
  if (!apiKey) {
    console.warn(
      `⚠️ [DEV SMS] FAST2SMS_API_KEY missing -> +91${cleanPhone} | Order #${shortOrderId} | OTP: ${cleanOtp}`
    );
    return {
      sent: false,
      phone: cleanPhone,
      reason: "FAST2SMS_API_KEY missing (logged to console)",
    };
  }

  const route = String(process.env.FAST2SMS_ROUTE || "q").trim().toLowerCase();

  let params;
  if (route === "dlt") {
    const senderId = String(process.env.FAST2SMS_SENDER_ID || "").trim();
    const templateId = String(process.env.FAST2SMS_TEMPLATE_ID || "").trim();

    if (!senderId || !templateId) {
      throw new Error(
        "FAST2SMS_SENDER_ID and FAST2SMS_TEMPLATE_ID are required for DLT route"
      );
    }

    const variablesValues = String(
      process.env.FAST2SMS_DLT_VARIABLES || `${shortOrderId}|${cleanOtp}`
    ).trim();

    params = new URLSearchParams({
      authorization: apiKey,
      route: "dlt",
      sender_id: senderId,
      message: templateId,
      variables_values: variablesValues,
      flash: "0",
      numbers: cleanPhone,
    });
  } else {
    const message = `PizzaZone Delivery OTP for Order #${shortOrderId} is ${cleanOtp}. Share this code with delivery partner upon arrival.`;
    params = new URLSearchParams({
      authorization: apiKey,
      route: "q",
      message,
      language: "english",
      flash: "0",
      numbers: cleanPhone,
    });
  }

  const url = `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { message: rawText || "Invalid response from SMS gateway" };
  }

  console.log("📲 [Fast2SMS Raw Response]:", {
    status: response.status,
    route,
    phone: cleanPhone,
    data,
  });

  if (!response.ok || data.return === false) {
    const errMsg =
      (Array.isArray(data.message) ? data.message.join(", ") : data.message) ||
      `SMS gateway failed (HTTP ${response.status})`;
    throw new Error(errMsg);
  }

  return {
    sent: true,
    provider: "fast2sms",
    route,
    phone: cleanPhone,
    data,
  };
};
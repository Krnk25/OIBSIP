import nodemailer from "nodemailer";

const createMailTransporter = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  const pass = String(process.env.EMAIL_PASS || "").trim();

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

export const sendDeliveryOtpEmail = async ({
  to,
  customerName = "Customer",
  otp,
  orderId,
  phone = "",
}) => {
  const cleanEmail = String(to || "").trim();
  if (!cleanEmail) {
    return { sent: false, reason: "Customer email address not found" };
  }

  const cleanOtp = String(otp || "").trim();
  if (!cleanOtp) {
    return { sent: false, reason: "Delivery OTP is missing" };
  }

  const transporter = createMailTransporter();
  if (!transporter) {
    console.warn(
      `⚠️ [DEV EMAIL OTP] EMAIL_USER/EMAIL_PASS missing -> ${cleanEmail} | OTP: ${cleanOtp}`
    );
    return {
      sent: false,
      reason: "EMAIL_USER or EMAIL_PASS missing in .env",
    };
  }

  const shortOrderId = String(orderId || "")
    .slice(-6)
    .toUpperCase();

  const mailOptions = {
    from: `"PizzaZone Delivery" <${String(process.env.EMAIL_USER).trim()}>`,
    to: cleanEmail,
    subject: `Delivery OTP ${cleanOtp} for Order #${shortOrderId}`,
    text: `Hello ${customerName},\n\nYour 4-digit Delivery OTP for Order #${shortOrderId} is: ${cleanOtp}\n\nPlease share this OTP with your delivery partner upon arrival.\n\n- PizzaZone Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="margin: 0 0 12px; color: #111;">PizzaZone Delivery OTP</h2>
        <p style="margin: 0 0 10px; color: #444;">Hi <strong>${customerName}</strong>,</p>
        <p style="margin: 0 0 16px; color: #444;">
          Your order <strong>#${shortOrderId}</strong> is out for delivery. Please share this 4-digit OTP with your delivery partner upon arrival:
        </p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 14px; background: #fff4ec; border: 1px dashed #ff6b00; border-radius: 8px; color: #d94e00; margin: 16px 0;">
          ${cleanOtp}
        </div>
        ${
          phone
            ? `<p style="font-size: 12px; color: #777; margin: 8px 0 0;">Registered Mobile: +91 ${phone}</p>`
            : ""
        }
        <p style="font-size: 12px; color: #777; margin: 12px 0 0;">
          Do not share this code until your order arrives.
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    sent: true,
    provider: "email",
    to: cleanEmail,
    messageId: info.messageId,
  };
};
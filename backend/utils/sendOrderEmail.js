import nodemailer from "nodemailer";

const formatItemsSummary = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "No items listed";
  }

  return items
    .map((item, index) => {
      const qty = Number(item.quantity ?? item.qty ?? 1);
      const price = Number(item.price ?? 0);
      const lineTotal = price * qty;
      const customParts = [];

      if (item.isCustom && item.customDetails) {
        if (item.customDetails.base?.name) {
          customParts.push(`Base: ${item.customDetails.base.name}`);
        }
        if (item.customDetails.sauce?.name) {
          customParts.push(`Sauce: ${item.customDetails.sauce.name}`);
        }
        if (item.customDetails.cheese?.name) {
          customParts.push(`Cheese: ${item.customDetails.cheese.name}`);
        }
        if (
          Array.isArray(item.customDetails.veggies) &&
          item.customDetails.veggies.length > 0
        ) {
          customParts.push(
            `Veggies: ${item.customDetails.veggies.map((v) => v.name).join(", ")}`
          );
        }
      }

      const customText =
        customParts.length > 0 ? ` [${customParts.join(" | ")}]` : "";

      return `${index + 1}. ${item.name} (${item.size || "medium"}) x ${qty} = ₹${lineTotal}${customText}`;
    })
    .join("\n");
};

const formatItemsHtml = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "<p>No items listed</p>";
  }

  return `
    <ul style="padding-left: 18px; margin: 8px 0;">
      ${items
        .map((item) => {
          const qty = Number(item.quantity ?? item.qty ?? 1);
          const price = Number(item.price ?? 0);
          const lineTotal = price * qty;
          const customParts = [];

          if (item.isCustom && item.customDetails) {
            if (item.customDetails.base?.name) {
              customParts.push(`Base: ${item.customDetails.base.name}`);
            }
            if (item.customDetails.sauce?.name) {
              customParts.push(`Sauce: ${item.customDetails.sauce.name}`);
            }
            if (item.customDetails.cheese?.name) {
              customParts.push(`Cheese: ${item.customDetails.cheese.name}`);
            }
            if (
              Array.isArray(item.customDetails.veggies) &&
              item.customDetails.veggies.length > 0
            ) {
              customParts.push(
                `Veggies: ${item.customDetails.veggies
                  .map((v) => v.name)
                  .join(", ")}`
              );
            }
          }

          const customHtml =
            customParts.length > 0
              ? `<br/><small style="color:#c2410c;">Custom: ${customParts.join(
                  " | "
                )}</small>`
              : "";

          return `<li style="margin-bottom: 6px;">
            <strong>${item.name}</strong> (${item.size || "medium"}) × ${qty} — <strong>₹${lineTotal}</strong>
            ${customHtml}
          </li>`;
        })
        .join("")}
    </ul>
  `;
};

export const sendNewOrderEmailToAdmin = async ({ order, customer }) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  const shortOrderId = String(order?._id || "")
    .slice(-6)
    .toUpperCase();

  const customerName =
    customer?.name ||
    order?.shippingAddress?.name ||
    order?.customerName ||
    "Guest Customer";
  const customerEmail =
    customer?.email ||
    order?.shippingAddress?.email ||
    order?.email ||
    "Not provided";
  const customerPhone =
    order?.shippingAddress?.phone ||
    order?.phone ||
    customer?.phone ||
    "Not provided";

  const itemsText = formatItemsSummary(order?.items || []);
  const itemsHtml = formatItemsHtml(order?.items || []);

  const subject = `🍕 New Pizza Order #${shortOrderId} from ${customerName} (₹${order?.totalAmount ?? 0})`;

  const text = [
    `New Pizza Order Received!`,
    `Order ID: #${shortOrderId} (${order?._id})`,
    `Customer Name: ${customerName}`,
    `Customer Email: ${customerEmail}`,
    `Customer Phone: ${customerPhone}`,
    `Delivery Address: ${order?.deliveryAddress || "N/A"}`,
    `Payment Method: ${order?.paymentMethod || "N/A"} (${order?.paymentStatus || "Pending"})`,
    `Total Amount: ₹${order?.totalAmount ?? 0}`,
    ``,
    `Ordered Pizzas & Items:`,
    itemsText,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 600px;">
      <h2 style="color: #172554; margin-bottom: 8px;">🍕 New Pizza Order #${shortOrderId}</h2>
      <p style="margin: 0 0 14px;">A customer just placed an order on PizzaZone:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
        <tr><td style="padding: 4px 0;"><strong>Customer:</strong></td><td>${customerName}</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Email:</strong></td><td>${customerEmail}</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Mobile:</strong></td><td>${customerPhone}</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Payment:</strong></td><td>${order?.paymentMethod || "N/A"} (${order?.paymentStatus || "Pending"})</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Total Amount:</strong></td><td><strong>₹${order?.totalAmount ?? 0}</strong></td></tr>
        <tr><td style="padding: 4px 0;"><strong>Address:</strong></td><td>${order?.deliveryAddress || "N/A"}</td></tr>
      </table>
      <h3 style="color: #172554; margin: 12px 0 6px;">Pizza &amp; Item Details</h3>
      ${itemsHtml}
    </div>
  `;

  if (!adminEmail) {
    console.log(`[DEV ORDER EMAIL] ADMIN_EMAIL missing.\n${text}`);
    return { sent: false, reason: "ADMIN_EMAIL not configured" };
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!smtpHost && (!smtpUser || !smtpPass)) {
    console.log(`[DEV ORDER EMAIL -> ${adminEmail}]\n${text}`);
    return {
      sent: false,
      to: adminEmail,
      reason: "SMTP/Email credentials missing (logged to console)",
    };
  }

  const transporter = smtpHost
    ? nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "false") === "true",
        auth:
          smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      })
    : nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || smtpUser || `"PizzaZone" <${adminEmail}>`,
    to: adminEmail,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    to: adminEmail,
    messageId: info.messageId,
  };
};
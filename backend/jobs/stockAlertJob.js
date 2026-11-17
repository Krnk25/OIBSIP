const cron = require('node-cron');
const Ingredient = require('../models/Ingredient');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const startStockAlertJob = () => {
  // दर ३० मिनिटांनी स्टॉक चेक करण्यासाठी: '*/30 * * * *'
  // (जर डेमो व्हिडिओमध्ये लगेच टेस्ट करायचे असेल तर '*/1 * * * *' म्हणजे दर १ मिनिटाला ठेवू शकतोस)
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('🔍 Running scheduled inventory stock check...');

      // ज्या इंग्रेडियंट्सचा stock त्यांच्या threshold पेक्षा कमी किंवा समान आहे ते शोधा
      const lowStockItems = await Ingredient.find({
        $expr: { $lte: ['$stock', '$threshold'] },
      });

      if (lowStockItems.length === 0) {
        console.log('✅ All ingredients are well-stocked.');
        return;
      }

      // सर्व Admin युजर्सचे ईमेल शोधा (किंवा .env मधील ईमेल वापरा)
      const admins = await User.find({ role: 'admin' });
      const adminEmails = admins.map((admin) => admin.email);

      if (adminEmails.length === 0 && process.env.EMAIL_USER) {
        adminEmails.push(process.env.EMAIL_USER);
      }

      if (adminEmails.length === 0) return;

      // ईमेलसाठी HTML टेबल तयार करा
      const itemRows = lowStockItems
        .map(
          (item) =>
            `<tr>
              <td style="padding:8px;border:1px solid #ddd;">${item.name}</td>
              <td style="padding:8px;border:1px solid #ddd;text-transform:capitalize;">${item.category}</td>
              <td style="padding:8px;border:1px solid #ddd;color:#e63946;font-weight:bold;">${item.stock}</td>
              <td style="padding:8px;border:1px solid #ddd;">${item.threshold}</td>
            </tr>`
        )
        .join('');

      const htmlContent = `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h2 style="color:#e63946;">⚠️ Low Stock Alert - Pizza House Inventory</h2>
          <p>The following ingredients have dropped below their threshold levels and need restocking:</p>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead>
              <tr style="background:#f4f4f4;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Ingredient</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Category</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Current Stock</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Threshold</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <p style="margin-top:15px;">Please log in to the <strong>Admin Dashboard</strong> to update stock quantities.</p>
        </div>
      `;

      for (const email of adminEmails) {
        await sendEmail({
          email,
          subject: `⚠️ Low Inventory Alert (${lowStockItems.length} items) - Pizza House`,
          html: htmlContent,
        });
      }

      console.log(`📧 Low stock alert email sent for ${lowStockItems.length} item(s).`);
    } catch (error) {
      console.error('❌ Stock Alert Cron Job Error:', error.message);
    }
  });
};

module.exports = startStockAlertJob;
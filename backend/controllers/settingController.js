import StoreSetting from "../models/StoreSetting.js";

const getOrCreateSetting = async () => {
  let setting = await StoreSetting.findOne({ key: "default" });
  if (!setting) {
    setting = await StoreSetting.create({
      key: "default",
      deliveryFee: 0,
      discountType: "none",
      discountValue: 0,
      minOrderAmount: 0,
    });
  }
  return setting;
};

// @desc    Get current delivery fee & discount settings
// @route   GET /api/settings
export const getStoreSettings = async (req, res) => {
  try {
    const setting = await getOrCreateSetting();
    return res.status(200).json(setting);
  } catch (error) {
    console.error("getStoreSettings error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update delivery fee & discount settings (Admin)
// @route   PUT /api/settings
export const updateStoreSettings = async (req, res) => {
  try {
    const deliveryFee = Math.max(0, Number(req.body.deliveryFee ?? 0));
    const discountType = ["none", "flat", "percentage"].includes(
      req.body.discountType
    )
      ? req.body.discountType
      : "none";
    let discountValue = Math.max(0, Number(req.body.discountValue ?? 0));
    if (discountType === "percentage" && discountValue > 100) {
      discountValue = 100;
    }
    const minOrderAmount = Math.max(0, Number(req.body.minOrderAmount ?? 0));

    const updated = await StoreSetting.findOneAndUpdate(
      { key: "default" },
      {
        key: "default",
        deliveryFee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
        discountType,
        discountValue: Number.isFinite(discountValue) ? discountValue : 0,
        minOrderAmount: Number.isFinite(minOrderAmount) ? minOrderAmount : 0,
      },
      { new: true, upsert: true, runValidators: true }
    );

    const io = req.app.get("io");
    if (io) {
      io.emit("storeSettingsUpdated", updated);
    }

    return res.status(200).json({
      message: "Delivery fee & discount settings updated!",
      settings: updated,
    });
  } catch (error) {
    console.error("updateStoreSettings error:", error);
    return res.status(500).json({ message: error.message });
  }
};
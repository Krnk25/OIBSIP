// routes/userRoutes.js (mounted at /api/users)
router.put("/profile", protect, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const cleanPhone = String(req.body.mobile ?? req.body.phone ?? user.phone ?? user.mobile ?? "")
      .replace(/\D/g, "")
      .slice(-10);

    if (req.body.name) user.name = String(req.body.name).trim();
    if (req.body.email) user.email = String(req.body.email).trim();
    user.mobile = cleanPhone;
    user.phone = cleanPhone;

    const updatedUser = await user.save();

    res.json({
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update profile" });
  }
});
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
const path = require("path");
const fs = require("fs/promises");

const { User } = require("../models/user");

const { HttpError, ctrlWrapper } = require("../helpers");

const { SECRET_KEY } = process.env;

const avatarsDir = path.join(__dirname, "../", "public", "avatars");

const register = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    throw HttpError(409, "Email already in use");
  }

  const hashPassword = await bcrypt.hash(password, 10);
  const avatarURL = gravatar.url(email);

  const newUser = await User.create({ ...req.body, password: hashPassword, avatarURL });

  res.status(201).json({ email: newUser.email });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    throw HttpError(401, "Email or password is wrong");
  }
  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, "Email or password is wrong");
  }

  const payload = {
    id: user._id,
  };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "23h" });
  await User.findByIdAndUpdate(user._id, { token });

  res.json({
    token,
  });
};

const getCurrent = async (req, res) => { 
   const { email, name } = req.user;
   
   res.json({
      email,
      name,
   })
}

const logout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: "" });

  res.json({
    message: "Logout success",
  });
};

const updateSubscription = async (req, res) => {
  const { subscription } = req.body;
  const { _id } = req.user;

  if (!["starter", "pro", "business"].includes(subscription)) {
    throw HttpError(400);
  }
  const updatedSubscription = await User.findByIdAndUpdate(
    _id,
    { subscription },
    {
      new: true,
    }
  );
  res.status(200).json({
    subscription: updatedSubscription.subscription,
  });
};

const updateAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path: tempUpload, originalname } = req.file;
  const filename = `${_id}_${originalname}`;
  const resultUpload = path.join(avatarsDir, filename);

  // Delete previous avatar, if exists
  const user = await User.findById(_id);
  if (user.avatarURL) {
    const previousAvatarPath = path.join(avatarsDir, path.basename(user.avatarURL));
    await fs.unlink(previousAvatarPath);
  }

  await fs.rename(tempUpload, resultUpload);
  const avatarURL = path.join("avatars", filename);

  await User.findByIdAndUpdate(_id, { avatarURL });

  res.json({
    avatarURL,
  });
};

module.exports = {
   register: ctrlWrapper(register),
   login: ctrlWrapper(login),
   getCurrent: ctrlWrapper(getCurrent),
   logout: ctrlWrapper(logout),
   updateSubscription: ctrlWrapper(updateSubscription),
   updateAvatar: ctrlWrapper(updateAvatar),
}
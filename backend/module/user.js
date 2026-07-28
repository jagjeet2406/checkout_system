const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        unique: true,
        required: true,
    },
    phone: {
        type: Number,
        required: false,
    },
    // ── NEW FIELDS FOR GOOGLE LOGIN ──
    photo: {
        type: String,
        default: "",
    },
    uid: {
        type: String,
        default: "",
    },
    loginType: {
        type: String,
        default: "email",
    },
});

module.exports = mongoose.model("login", UserSchema);
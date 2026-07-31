const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Razorpay = require("razorpay");
const nodemailer = require("nodemailer");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Create Order ─────────────────────────────────────────────
// Frontend sends the amount it *thinks* is payable, but we don't
// trust it — recompute from cartItems server-side so a tampered
// client can't pay ₹1 for a ₹5000 order.
router.post("/create-order", async (req, res) => {
    try {
        const { cartItems } = req.body;

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ error: "Cart is empty" });
        }

        const getPrice = (str) => Number(String(str).replace("₹", "").replace(/,/g, ""));

        const subtotal = cartItems.reduce(
            (sum, item) => sum + getPrice(item.price) * item.quantity,
            0
        );
        const total = subtotal + 0; // shipping, same as frontend

        if (!Number.isFinite(total) || total <= 0) {
            return res.status(400).json({ error: "Invalid order total" });
        }

        const order = await razorpay.orders.create({
            amount: Math.round(total * 100), // paise
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
        });

        res.json(order);
    } catch (err) {
        console.error("Create order error:", err);
        res.status(500).json({ error: "Could not create order" });
    }
});

// ── Verify Payment ───────────────────────────────────────────
router.post("/verify-payment", async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            customerDetails,
            cartItems,
            totalAmount,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, error: "Missing payment fields" });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const isValid = crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(razorpay_signature)
        );

        if (!isValid) {
            return res.status(400).json({ success: false, error: "Invalid signature" });
        }

        // Payment is genuine at this point.
        // TODO: save the order (customerDetails, cartItems, totalAmount,
        // razorpay_payment_id) to MongoDB here so you have a record even
        // if the notification email step below fails.

        console.log("Verified payment:", razorpay_payment_id, "for", customerDetails?.email);

        // Send order notification email to the shop owner. Awaited so a
        // failure shows up in logs, but it never blocks the success
        // response to the customer — the payment is already confirmed.
        await notifyOwner(customerDetails, cartItems, totalAmount, razorpay_payment_id);

        res.json({ success: true });
    } catch (err) {
        console.error("Verify payment error:", err);
        res.status(500).json({ success: false, error: "Verification failed" });
    }
});

// ── Nodemailer: notify the shop owner of a new order ───────────
async function notifyOwner(customer, cartItems, totalAmount, paymentId) {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        });

        const itemsList = cartItems
            .map(item => `  • ${item.name} x${item.quantity} = Rs.${Number(String(item.price).replace("₹", "").replace(/,/g, "")) * item.quantity}`)
            .join("\n");

        await transporter.sendMail({
            from: `"IR Punjabi Jutti Orders" <${process.env.GMAIL_USER}>`,
            to: process.env.OWNER_EMAIL,
            subject: `🛍️ New Order Received — Rs.${totalAmount} — ${customer.fullName}`,
            text: `
NEW ORDER RECEIVED
IR Punjabi Jutti
─────────────────────────────

CUSTOMER DETAILS
Name    : ${customer.fullName}
Phone   : ${customer.phone}
Email   : ${customer.email || "Not provided"}

DELIVERY ADDRESS
${customer.address}
${customer.city}, ${customer.state} - ${customer.pincode}

ITEMS ORDERED
${itemsList}

─────────────────────────────
TOTAL PAID   : Rs. ${totalAmount}
Payment ID   : ${paymentId}
Status       : PAID ✅
─────────────────────────────

— IR Punjabi Jutti Notification System
            `.trim(),
        });

        console.log("✅ Order email sent to owner at", process.env.OWNER_EMAIL);
    } catch (err) {
        // Log the full error (not just err.message) so auth/connection
        // issues show up clearly in the Render logs.
        console.error("Email failed:", err);
    }
}

module.exports = router;

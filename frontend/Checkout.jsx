import { useState } from "react";
import { useCart } from "./CartContext";

// Backend URL — set VITE_API_URL in .env for prod, falls back to localhost for dev
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Razorpay PUBLIC key id only — never put the key secret here
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

export default function Checkout() {
    const { cart } = useCart();
    const getPrice = (str) => Number(str.replace("₹", "").replace(",", ""));

    // ── Totals (same logic as cart.jsx) ──────────────────────────
    const basePayable = cart.reduce((sum, item) =>
        sum + getPrice(item.price) * item.quantity, 0
    );
    const totalPayable = basePayable + 29; // +29 shipping

    // ── State ─────────────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [form, setForm] = useState({
        fullName: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
    });

    // ── Input Handler ─────────────────────────────────────────────
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setErrors({ ...errors, [e.target.name]: "" });
    };

    // ── Validation ────────────────────────────────────────────────
    const validate = () => {
        const err = {};
        if (!form.fullName.trim()) err.fullName = "Full name is required";
        if (!form.phone.trim() || form.phone.length !== 10)
            err.phone = "Enter valid 10 digit phone number";
        if (!form.address.trim()) err.address = "Address is required";
        if (!form.city.trim()) err.city = "City is required";
        if (!form.state.trim()) err.state = "State is required";
        if (!form.pincode.trim() || form.pincode.length !== 6)
            err.pincode = "Enter valid 6 digit pincode";
        return err;
    };

    // ── Submit Form → Open Razorpay ───────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);
        try {
            // Step 1 — Create order on backend
            const orderRes = await fetch(`${API_URL}/api/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: totalPayable,
                    customerDetails: form,
                    cartItems: cart,
                }),
            });
            const orderData = await orderRes.json();
            if (!orderRes.ok || !orderData?.id) {
                throw new Error(orderData?.error || "Could not create order");
            }

            // Step 2 — Open Razorpay popup
            const options = {
                key: RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: "INR",
                name: "IR Punjabi Jutti",
                description: "Authentic Punjabi Juttis",
                order_id: orderData.id,
                handler: async function (response) {
                    // Step 3 — Verify payment + send WhatsApp to owner
                    const verifyRes = await fetch(`${API_URL}/api/verify-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            customerDetails: form,
                            cartItems: cart,
                            totalAmount: totalPayable,
                        }),
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        alert("✅ Payment Successful! Thank you for your order. We will contact you soon.");
                        window.location.href = "/";
                    } else {
                        alert("Payment verification failed. Please contact support.");
                    }
                },
                prefill: {
                    name: form.fullName,
                    contact: form.phone,
                    email: form.email,
                },
                theme: { color: "#8B0000" },
                modal: {
                    ondismiss: () => setLoading(false),
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (err) {
            console.error("Payment error:", err);
            alert("Something went wrong. Please try again.");
        }
        setLoading(false);
    };

    // ── UI ────────────────────────────────────────────────────────
    return (
        <div className="checkout_page">
            

            <div className="checkout_layout">

                {/* ── LEFT: Form ── */}
                <form className="checkout_form" onSubmit={handleSubmit}>
                    <h2 className="checkout_heading">Delivery Details</h2>
                    <p className="checkout_sub">Please fill in your details before payment</p>

                    <div className="form_row">
                        <div className="form_group">
                            <label>Full Name :</label>
                            <input
                                type="text"
                                name="fullName"
                                placeholder="Rahul Sharma"
                                value={form.fullName}
                                onChange={handleChange}
                            />
                            {errors.fullName && <span className="form_error">{errors.fullName}</span>}
                        </div>
                        <div className="form_group">
                            <label>Phone Number :</label>
                            <input
                                type="tel"
                                name="phone"
                                placeholder="98XXXXXXXX"
                                maxLength={10}
                                value={form.phone}
                                onChange={handleChange}
                            />
                            {errors.phone && <span className="form_error">{errors.phone}</span>}
                        </div>
                    </div>

                    <div className="form_group">
                        <label>Email (optional):</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="rahul@email.com"
                            value={form.email}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form_group">
                        <label>Full Address :</label>
                        <textarea
                            name="address"
                            placeholder="House No., Street, Area, Landmark..."
                            rows={3}
                            value={form.address}
                            onChange={handleChange}
                        />
                        {errors.address && <span className="form_error">{errors.address}</span>}
                    </div>

                    <div className="form_row">
                        <div className="form_group">
                            <label>City :</label>
                            <input
                                type="text"
                                name="city"
                                placeholder="Ludhiana"
                                value={form.city}
                                onChange={handleChange}
                            />
                            {errors.city && <span className="form_error">{errors.city}</span>}
                        </div>

                        <div className="form_group">
                            <label>State :</label>
                            <select name="state" value={form.state} onChange={handleChange}>
                                <option value="">Select State</option>
                                <option>Punjab</option>
                                <option>Haryana</option>
                                <option>Delhi</option>
                                <option>Himachal Pradesh</option>
                                <option>Rajasthan</option>
                                <option>Uttar Pradesh</option>
                                <option>Maharashtra</option>
                                <option>Gujarat</option>
                                <option>Karnataka</option>
                                <option>Tamil Nadu</option>
                                <option>West Bengal</option>
                                <option>Madhya Pradesh</option>
                                <option>Bihar</option>
                                <option>Uttarakhand</option>
                                <option>Jammu & Kashmir</option>
                                <option>Other</option>
                            </select>
                            {errors.state && <span className="form_error">{errors.state}</span>}
                        </div>

                        <div className="form_group">
                            <label>Pincode :</label>
                            <input
                                type="text"
                                name="pincode"
                                placeholder="141001"
                                maxLength={6}
                                value={form.pincode}
                                onChange={handleChange}
                            />
                            {errors.pincode && <span className="form_error">{errors.pincode}</span>}
                        </div>
                    </div>

                    <div className="summary_divider" />

                    <div className="summary_row">
                        <span>Subtotal</span>
                        <span>₹{basePayable}</span>
                    </div>
                    <div className="summary_row shipping">
                        <span>Shipping</span>
                        <span style={{ color: "green" }}>₹29</span>
                    </div>
                    <div className="summary_row_total">
                        <strong>Total Payable</strong>
                        <strong>₹{totalPayable}</strong>
                    </div>

                    <button
                        type="submit"
                        className="checkout_btn"
                        disabled={loading || cart.length === 0}
                    >
                        {loading ? "Processing..." : `Pay ₹${totalPayable} →`}
                    </button>

                    <p className="secure_note">🔒 Secured by Razorpay. UPI · Cards · Net Banking · Wallets</p>
                </form>

                {/* ── RIGHT: Order Summary ── */}
                <div className="checkout_summary">
                    <h3>Order Summary</h3>
                    <div className="order_cards">
                        {cart.map((item, i) => (
                            <div className="summary_item" key={i}>
                                <img src={item.link} alt={item.name} className="summary_img" />
                                <div className="summary_item_info">
                                    <p className="summary_name">{item.name}</p>
                                    <p className="summary_qty">Qty: {item.quantity}</p>
                                    <p className="summary_price">₹{getPrice(item.price) * item.quantity}</p>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && <p style={{ color: "#aaa" }}>Your cart is empty</p>}
                    </div>

                    
                </div>
            </div>
        </div>
    );
}

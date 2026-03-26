import crypto from "crypto";
import Booking from '../models/Booking.js'
import { inngest } from "../inngest/index.js";

export const razorpayWebhooks = async (request, response)=>{
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = request.headers["x-razorpay-signature"];
    
    const body = request.rawBody || JSON.stringify(request.body);

    try {
        // Verify Razorpay webhook signature
        const hash = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        if (hash !== signature) {
            return response.status(400).json({ error: "Invalid signature" });
        }

        const event = request.body;

        switch (event.event) {
            case "payment.authorized": {
                const paymentId = event.payload.payment.entity.id;
                const orderId = event.payload.payment.entity.notes.bookingId;

                // Update booking as paid
                await Booking.findByIdAndUpdate(orderId, {
                    isPaid: true,
                    paymentLink: "",
                    razorpayPaymentId: paymentId
                });

                // Send Confirmation Email
                await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId: orderId }
                });

                break;
            }

            case "payment.captured": {
                const paymentId = event.payload.payment.entity.id;
                const orderId = event.payload.payment.entity.notes.bookingId;

                // Update booking as paid
                await Booking.findByIdAndUpdate(orderId, {
                    isPaid: true,
                    paymentLink: "",
                    razorpayPaymentId: paymentId
                });

                // Send Confirmation Email
                await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId: orderId }
                });

                break;
            }

            case "payment.failed": {
                const orderId = event.payload.payment.entity.notes.bookingId;

                // Mark booking as failed (optional)
                await Booking.findByIdAndUpdate(orderId, {
                    isPaid: false,
                    paymentStatus: "failed"
                });

                console.log(`Payment failed for booking: ${orderId}`);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.event}`);
        }

        response.json({ received: true });

    } catch (err) {
        console.error("Webhook processing error:", err);
        response.status(500).json({ error: "Internal Server Error" });
    }
}

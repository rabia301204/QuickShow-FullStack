import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    user: {type: String, required: true, ref: 'User'},
    show: {type: String, required: true, ref: 'Show'},
    amount: {type: Number, required: true},
    bookedSeats: {type: Array, required: true},
    isPaid: {type: Boolean,  default:false},
    paymentLink: {type: String},
    razorpayOrderId: {type: String},
    razorpayPaymentId: {type: String},
    paymentStatus: {type: String, default: 'pending'}
},{timestamps: true })

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
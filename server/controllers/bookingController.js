import crypto from 'crypto';
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js"
import Razorpay from 'razorpay'


// Function to check availability of selected seats for a movie
const checkSeatsAvailability = async (showId, selectedSeats)=>{
    try {
        const showData = await Show.findById(showId)
        if(!showData) return false;

        const occupiedSeats = showData.occupiedSeats;

        const isAnySeatTaken = selectedSeats.some(seat => occupiedSeats[seat]);

        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message);
        return false;
    }
}

export const createBooking = async (req, res)=>{
    try {
        const {userId} = req.auth();
        const {showId, selectedSeats} = req.body;
        const { origin } = req.headers;

        // Check if the seat is available for the selected show
        const isAvailable = await checkSeatsAvailability(showId, selectedSeats)

        if(!isAvailable){
            return res.json({success: false, message: "Selected Seats are not available."})
        }

        // Get the show details
        const showData = await Show.findById(showId).populate('movie');

        // Create a new booking
        const booking = await Booking.create({
            user: userId,
            show: showId,
            amount: showData.showPrice * selectedSeats.length,
            bookedSeats: selectedSeats
        })

        selectedSeats.map((seat)=>{
            showData.occupiedSeats[seat] = userId;
        })

        showData.markModified('occupiedSeats');

        await showData.save();

         // Razorpay Gateway Initialize
         const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_SECRET_KEY
         })

         // Create Razorpay Order
         const orderOptions = {
            amount: Math.floor(booking.amount) * 100, // Amount in paise (smallest unit)
            currency: 'INR',
            receipt: booking._id.toString(),
            notes: {
                bookingId: booking._id.toString(),
                movieTitle: showData.movie.title,
                userEmail: req.auth().user?.primaryEmailAddress?.emailAddress || 'user@example.com'
            }
         }

         const order = await razorpayInstance.orders.create(orderOptions);

         booking.razorpayOrderId = order.id;
         booking.paymentLink = `${origin}/checkout?orderId=${order.id}&bookingId=${booking._id}`;
         await booking.save()

         console.log("[booking/create] Razorpay order", {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            bookingId: booking._id.toString(),
         })

         // Run Inngest Scheduler Function to check payment status after 10 minutes
         await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString()
            }
         })

         res.json({
            success: true,
            orderId: order.id,
            url: booking.paymentLink,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            amount: Math.floor(booking.amount) * 100,
            bookingId: booking._id.toString()
         })

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

export const verifyBookingPayment = async (req, res)=>{
    try {
        const { orderId, paymentId, signature, bookingId } = req.body;

        const razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_SECRET_KEY
        });

        // Razorpay verification: HMAC SHA256 over orderId|paymentId
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        if (generated_signature !== signature) {
            console.error('[verifyBookingPayment] signature mismatch', { orderId, paymentId, signature, generated_signature });
            return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
        }

        await Booking.findByIdAndUpdate(bookingId, {
            isPaid: true,
            paymentStatus: 'captured',
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            paymentLink: ''
        });

        await inngest.send({
            name: 'app/show.booked',
            data: { bookingId }
        });

        return res.json({ success: true, message: 'Payment verified successfully.' });
    } catch (error) {
        console.error('verifyBookingPayment error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const getOccupiedSeats = async (req, res)=>{
    try {
        
        const {showId} = req.params;
        const showData = await Show.findById(showId)

        const occupiedSeats = Object.keys(showData.occupiedSeats)

        res.json({success: true, occupiedSeats})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}
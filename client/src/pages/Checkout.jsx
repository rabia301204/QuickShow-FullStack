import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import Loading from '../components/Loading'
import BlurCircle from '../components/BlurCircle'
import toast from 'react-hot-toast'

const Checkout = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { axios, getToken, user } = useAppContext()

    const [bookingDetails, setBookingDetails] = useState(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    const orderId = searchParams.get('orderId')
    const bookingId = searchParams.get('bookingId')

    useEffect(() => {
        if (!orderId || !bookingId) {
            toast.error('Invalid checkout session')
            navigate('/my-bookings')
            return
        }

        fetchBookingDetails()
    }, [orderId, bookingId])

    const fetchBookingDetails = async () => {
        try {
            const { data } = await axios.get(`/api/user/bookings`, {
                headers: { Authorization: `Bearer ${await getToken()}` }
            })

            if (data.success) {
                const booking = data.bookings.find(b => b._id === bookingId)
                if (booking) {
                    setBookingDetails(booking)
                } else {
                    toast.error('Booking not found')
                    navigate('/my-bookings')
                }
            }
        } catch (error) {
            console.error('Error fetching booking details:', error)
            toast.error('Failed to load booking details')
            navigate('/my-bookings')
        } finally {
            setLoading(false)
        }
    }

    const handlePayment = async () => {
        if (!bookingDetails) return

        setProcessing(true)

        try {
            // Initialize Razorpay
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: bookingDetails.amount * 100, // Amount in paise
                currency: 'INR',
                name: 'QuickShow',
                description: `Booking for ${bookingDetails.show.movie.title}`,
                order_id: orderId,
                handler: async function (response) {
                    const payload = {
                        orderId,
                        paymentId: response.razorpay_payment_id,
                        signature: response.razorpay_signature,
                        bookingId
                    }

                    try {
                        const verifyResponse = await axios.post('/api/booking/verify', payload, {
                            headers: { Authorization: `Bearer ${await getToken()}` }
                        })

                        if (verifyResponse.data.success) {
                            toast.success('Payment successful!')
                            navigate('/loading/my-bookings')
                        } else {
                            console.error('Payment verification failed (backend):', verifyResponse.data)
                            toast.error('Payment verification failed: ' + verifyResponse.data.message)
                            navigate('/my-bookings')
                        }
                    } catch (error) {
                        console.error('Payment verification error:', error.response?.data || error.message)
                        toast.error('Payment verification failed. Please contact support.')
                        navigate('/my-bookings')
                    }
                },
                prefill: {
                    name: user?.fullName || '',
                    email: user?.primaryEmailAddress?.emailAddress || '',
                },
                theme: {
                    color: '#F84565'
                },
                modal: {
                    ondismiss: function() {
                        // Payment cancelled
                        toast.error('Payment cancelled')
                        navigate('/my-bookings')
                    }
                }
            }

            const rzp = new window.Razorpay(options)
            rzp.open()

        } catch (error) {
            console.error('Payment initialization error:', error)
            toast.error('Failed to initialize payment')
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return <Loading />
    }

    if (!bookingDetails) {
        return (
            <div className='flex justify-center items-center h-screen'>
                <div className='text-center'>
                    <h2 className='text-xl font-semibold mb-4'>Booking not found</h2>
                    <button
                        onClick={() => navigate('/my-bookings')}
                        className='px-6 py-2 bg-primary text-white rounded-lg'
                    >
                        Go to My Bookings
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className='relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]'>
            <BlurCircle top="100px" left="100px"/>
            <div className='max-w-2xl mx-auto'>
                <h1 className='text-3xl font-semibold text-center mb-8'>Complete Your Payment</h1>

                <div className='bg-primary/10 border border-primary/20 rounded-lg p-6 mb-8'>
                    <h2 className='text-xl font-semibold mb-4'>Booking Summary</h2>

                    <div className='space-y-3'>
                        <div className='flex justify-between'>
                            <span className='text-gray-400'>Movie:</span>
                            <span className='font-medium'>{bookingDetails.show.movie.title}</span>
                        </div>

                        <div className='flex justify-between'>
                            <span className='text-gray-400'>Date & Time:</span>
                            <span className='font-medium'>
                                {new Date(bookingDetails.show.showDateTime).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>

                        <div className='flex justify-between'>
                            <span className='text-gray-400'>Seats:</span>
                            <span className='font-medium'>{bookingDetails.bookedSeats.join(', ')}</span>
                        </div>

                        <div className='flex justify-between'>
                            <span className='text-gray-400'>Tickets:</span>
                            <span className='font-medium'>{bookingDetails.bookedSeats.length}</span>
                        </div>

                        <div className='border-t border-primary/20 pt-3 mt-4'>
                            <div className='flex justify-between text-lg font-semibold'>
                                <span>Total Amount:</span>
                                <span>₹{bookingDetails.amount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='text-center'>
                    <button
                        onClick={handlePayment}
                        disabled={processing}
                        className='px-8 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        {processing ? 'Processing...' : `Pay ₹${bookingDetails.amount}`}
                    </button>

                    <p className='text-sm text-gray-400 mt-4'>
                        You will be redirected to Razorpay secure payment gateway
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Checkout
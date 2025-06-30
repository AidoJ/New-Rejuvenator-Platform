import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Calendar, Clock, MapPin, User, CreditCard, CheckCircle, X, Timer, DollarSign, Menu, LogOut } from 'lucide-react';

// Initialize services
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_KEY || ''
);

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_KEY || '');

// Service data
const SERVICES = [
  { id: 1, name: 'Stressbuster', baseDuration: 60, basePrice: 80, increment: 30, incrementPrice: 40 },
  { id: 2, name: 'Sports Massage', baseDuration: 60, basePrice: 90, increment: 30, incrementPrice: 45 },
  { id: 3, name: 'Deep Tissue', baseDuration: 60, basePrice: 100, increment: 30, incrementPrice: 50 },
  { id: 4, name: 'Swedish Relaxation', baseDuration: 60, basePrice: 85, increment: 30, incrementPrice: 42 },
  { id: 5, name: 'Prenatal', baseDuration: 60, basePrice: 95, increment: 30, incrementPrice: 47 }
];

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await checkUser();
      } else {
        setUser(null);
        setUserRole(null);
        setCurrentView('login');
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (userData) {
          setUserRole(userData.role);
          setCurrentView(userData.role === 'admin' ? 'admin' : userData.role === 'therapist' ? 'therapist' : 'booking');
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setCurrentView('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user && (
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">Rejuvenators Mobile Massage</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user && currentView === 'login' && <LoginForm onSuccess={checkUser} />}
        {user && userRole === 'customer' && currentView === 'booking' && <BookingFlow user={user} />}
        {user && userRole === 'therapist' && currentView === 'therapist' && <TherapistDashboard user={user} />}
        {user && userRole === 'admin' && currentView === 'admin' && <AdminDashboard />}
      </main>
    </div>
  );
}

// Login/Signup Form
function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isTherapist, setIsTherapist] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: userError } = await supabase.from('users').insert({
            id: authData.user.id,
            email,
            name,
            phone,
            role: isTherapist ? 'therapist' : 'customer'
          });

          if (userError) throw userError;

          if (isTherapist) {
            const { error: profileError } = await supabase.from('therapist_profiles').insert({
              user_id: authData.user.id,
              bio: '',
              lat: 0,
              lon: 0
            });

            if (profileError) throw profileError;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {isSignup ? 'Create Account' : 'Sign In'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                required
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            required
          />

          {isSignup && (
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isTherapist}
                onChange={(e) => setIsTherapist(e.target.checked)}
                className="rounded text-purple-600"
              />
              <span className="text-sm text-gray-700">Sign up as a therapist</span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignup(!isSignup);
              setError('');
            }}
            className="text-purple-600 hover:text-purple-700 text-sm"
          >
            {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Booking Flow Component
function BookingFlow({ user }) {
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    address: '',
    lat: null,
    lon: null,
    service: null,
    duration: 60,
    date: '',
    time: '',
    therapist: null,
    parking: '',
    roomDetails: '',
    price: 0
  });

  const updateBookingData = (data) => {
    setBookingData(prev => ({ ...prev, ...data }));
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <AddressStep data={bookingData} updateData={updateBookingData} onNext={() => setStep(2)} />;
      case 2:
        return <ServiceStep data={bookingData} updateData={updateBookingData} onNext={() => setStep(3)} onBack={() => setStep(1)} />;
      case 3:
        return <DateTimeStep data={bookingData} updateData={updateBookingData} onNext={() => setStep(4)} onBack={() => setStep(2)} />;
      case 4:
        return <TherapistStep data={bookingData} updateData={updateBookingData} onNext={() => setStep(5)} onBack={() => setStep(3)} />;
      case 5:
        return <BookingDetailsStep data={bookingData} updateData={updateBookingData} onNext={() => setStep(6)} onBack={() => setStep(4)} />;
      case 6:
        return <PaymentStep data={bookingData} user={user} onSuccess={() => setStep(7)} onBack={() => setStep(5)} />;
      case 7:
        return <ThankYouStep data={bookingData} onNewBooking={() => { setStep(1); setBookingData({}); }} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div
              key={s}
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                s <= step ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
      {renderStep()}
    </div>
  );
}

// Step 1: Address
function AddressStep({ data, updateData, onNext }) {
  const [address, setAddress] = useState(data.address || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    // In production, would use Google Places API here
    updateData({ 
      address, 
      lat: -33.8688 + (Math.random() - 0.5) * 0.1, 
      lon: 151.2093 + (Math.random() - 0.5) * 0.1 
    });
    onNext();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center">
        <MapPin className="mr-2 h-5 w-5 text-purple-600" />
        Service Address
      </h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter your address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent mb-4"
          required
        />
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
        >
          Next
        </button>
      </form>
    </div>
  );
}

// Step 2: Service Selection
function ServiceStep({ data, updateData, onNext, onBack }) {
  const [service, setService] = useState(data.service || null);
  const [duration, setDuration] = useState(data.duration || 60);

  const calculatePrice = (service, duration) => {
    if (!service) return 0;
    const additionalTime = duration - service.baseDuration;
    const additionalIncrements = additionalTime / service.increment;
    return service.basePrice + (additionalIncrements * service.incrementPrice);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateData({ 
      service, 
      duration, 
      price: calculatePrice(service, duration) 
    });
    onNext();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Select Service & Duration</h3>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          {SERVICES.map((s) => (
            <label
              key={s.id}
              className={`block p-4 border rounded-lg cursor-pointer transition ${
                service?.id === s.id 
                  ? 'border-purple-600 bg-purple-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={service?.id === s.id}
                onChange={() => setService(s)}
                className="sr-only"
              />
              <div className="flex justify-between items-center">
                <span className="font-medium">{s.name}</span>
                <span className="text-gray-600">${s.basePrice} base</span>
              </div>
            </label>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (minutes)
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
          >
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
            <option value={120}>120 minutes</option>
          </select>
        </div>

        {service && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Price:</span>
              <span className="text-2xl font-bold text-purple-600">
                ${calculatePrice(service, duration)}
              </span>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!service}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </form>
    </div>
  );
}

// Step 3: Date & Time
function DateTimeStep({ data, updateData, onNext, onBack }) {
  const [date, setDate] = useState(data.date || '');
  const [time, setTime] = useState(data.time || '');

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateData({ date, time });
    onNext();
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center">
        <Calendar className="mr-2 h-5 w-5 text-purple-600" />
        Select Date & Time
      </h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time
          </label>
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            required
          >
            <option value="">Select time</option>
            {generateTimeSlots().map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!date || !time}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </form>
    </div>
  );
}

// Step 4: Therapist Selection
function TherapistStep({ data, updateData, onNext, onBack }) {
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(data.therapist || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableTherapists();
  }, []);

  const fetchAvailableTherapists = async () => {
    try {
      // In production, would filter by proximity and availability
      const { data: therapistData } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'therapist');

      setTherapists(therapistData || []);
    } catch (error) {
      console.error('Error fetching therapists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateData({ therapist: selectedTherapist });
    onNext();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center">
        <User className="mr-2 h-5 w-5 text-purple-600" />
        Select Therapist
      </h3>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          {therapists.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No therapists available</p>
          ) : (
            therapists.map((therapist) => (
              <label
                key={therapist.id}
                className={`block p-4 border rounded-lg cursor-pointer transition ${
                  selectedTherapist?.id === therapist.id 
                    ? 'border-purple-600 bg-purple-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="therapist"
                  value={therapist.id}
                  checked={selectedTherapist?.id === therapist.id}
                  onChange={() => setSelectedTherapist(therapist)}
                  className="sr-only"
                />
                <div className="flex justify-between items-center">
                  <span className="font-medium">{therapist.name}</span>
                  <span className="text-sm text-gray-600">Within 10km</span>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!selectedTherapist}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </form>
    </div>
  );
}

// Step 5: Booking Details
function BookingDetailsStep({ data, updateData, onNext, onBack }) {
  const [parking, setParking] = useState(data.parking || '');
  const [roomDetails, setRoomDetails] = useState(data.roomDetails || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    updateData({ parking, roomDetails });
    onNext();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Additional Details</h3>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Parking Instructions
          </label>
          <textarea
            value={parking}
            onChange={(e) => setParking(e.target.value)}
            placeholder="e.g., Street parking available, use visitor spot #3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            rows={3}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Room Setup Details
          </label>
          <textarea
            value={roomDetails}
            onChange={(e) => setRoomDetails(e.target.value)}
            placeholder="e.g., Second floor, first room on the right"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            rows={3}
          />
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Booking Summary</h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-600">Service:</span> {data.service?.name}</p>
            <p><span className="text-gray-600">Duration:</span> {data.duration} minutes</p>
            <p><span className="text-gray-600">Date:</span> {data.date}</p>
            <p><span className="text-gray-600">Time:</span> {data.time}</p>
            <p><span className="text-gray-600">Therapist:</span> {data.therapist?.name}</p>
            <p><span className="text-gray-600">Address:</span> {data.address}</p>
            <p className="font-semibold text-purple-600 pt-2">Total: ${data.price}</p>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
          >
            Proceed to Payment
          </button>
        </div>
      </form>
    </div>
  );
}

// Step 6: Payment
function PaymentStep({ data, user, onSuccess, onBack }) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm data={data} user={user} onSuccess={onSuccess} onBack={onBack} />
    </Elements>
  );
}

function PaymentForm({ data, user, onSuccess, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [bookingId, setBookingId] = useState(null);
  const [requestStatus, setRequestStatus] = useState('pending');
  const [timeRemaining, setTimeRemaining] = useState(120);

  useEffect(() => {
    createBookingRequest();
  }, []);

  useEffect(() => {
    if (requestStatus === 'pending' && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && requestStatus === 'pending') {
      setRequestStatus('timeout');
    }
  }, [timeRemaining, requestStatus]);

  const createBookingRequest = async () => {
    try {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          therapist_id: data.therapist.id,
          service_id: data.service.id,
          duration: data.duration,
          date: data.date,
          time: data.time,
          address: data.address,
          lat: data.lat,
          lon: data.lon,
          parking: data.parking,
          room_details: data.roomDetails,
          price: data.price,
          status: 'requested'
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      setBookingId(booking.id);
      
      // Simulate sending notification to therapist
      console.log('Notification sent to therapist');
      
      // Simulate therapist response after 5 seconds
      setTimeout(() => {
        setRequestStatus('accepted');
      }, 5000);
    } catch (error) {
      console.error('Error creating booking:', error);
      setError('Failed to create booking request');
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements || requestStatus !== 'accepted') {
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // In production, you would create a payment intent on the server
      const cardElement = elements.getElement(CardElement);
      
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        throw stripeError;
      }

      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingId,
          stripe_payment_id: paymentMethod.id,
          amount: data.price,
          status: 'completed'
        });

      if (paymentError) throw paymentError;

      onSuccess();
    } catch (error) {
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center">
        <CreditCard className="mr-2 h-5 w-5 text-purple-600" />
        Payment
      </h3>

      {requestStatus === 'pending' && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-yellow-800">Waiting for therapist confirmation...</span>
            <span className="flex items-center text-yellow-800">
              <Timer className="h-4 w-4 mr-1" />
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="w-full bg-yellow-200 rounded-full h-2">
            <div 
              className="bg-yellow-600 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${(timeRemaining / 120) * 100}%` }}
            />
          </div>
        </div>
      )}

      {requestStatus === 'accepted' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center text-green-800">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">Booking accepted! Please complete payment.</span>
          </div>
        </div>
      )}

      {requestStatus === 'timeout' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-800">
            <X className="h-5 w-5 mr-2" />
            <span className="font-medium">Request timed out. Please try another therapist.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handlePayment}>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <div className="p-3 border border-gray-300 rounded-lg">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total Amount:</span>
            <span className="text-purple-600">${data.price}</span>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!stripe || processing || requestStatus !== 'accepted'}
            className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {processing ? 'Processing...' : `Pay ${data.price}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// Step 7: Thank You
function ThankYouStep({ data, onNewBooking }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 text-center">
      <div className="mb-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
      </div>
      
      <h3 className="text-2xl font-semibold mb-4">Booking Confirmed!</h3>
      
      <p className="text-gray-600 mb-6">
        Your massage has been booked successfully. You'll receive a confirmation email shortly.
      </p>

      <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
        <h4 className="font-medium mb-2">Appointment Details</h4>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Service:</span> {data.service?.name}</p>
          <p><span className="text-gray-600">Date:</span> {data.date}</p>
          <p><span className="text-gray-600">Time:</span> {data.time}</p>
          <p><span className="text-gray-600">Duration:</span> {data.duration} minutes</p>
          <p><span className="text-gray-600">Therapist:</span> {data.therapist?.name}</p>
          <p><span className="text-gray-600">Location:</span> {data.address}</p>
        </div>
      </div>

      <button
        onClick={onNewBooking}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
      >
        Book Another Appointment
      </button>
    </div>
  );
}

// Therapist Dashboard
function TherapistDashboard({ user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchBookings = async () => {
    try {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customer_id(name, email, phone),
          service:service_id(name)
        `)
        .eq('therapist_id', user.id)
        .in('status', ['requested', 'confirmed'])
        .order('date', { ascending: true });

      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingResponse = async (bookingId, response) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: response })
        .eq('id', bookingId);

      if (!error) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Therapist Dashboard</h2>
      
      <div className="grid gap-6">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
            No pending bookings
          </div>
        ) : (
          bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{booking.service.name}</h3>
                  <p className="text-gray-600">{booking.customer.name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  booking.status === 'requested' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {booking.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-600">Date:</span> {booking.date}
                </div>
                <div>
                  <span className="text-gray-600">Time:</span> {booking.time}
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span> {booking.duration} min
                </div>
                <div>
                  <span className="text-gray-600">Price:</span> ${booking.price}
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">Address:</p>
                <p className="text-sm">{booking.address}</p>
              </div>

              {booking.parking && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Parking:</p>
                  <p className="text-sm">{booking.parking}</p>
                </div>
              )}

              {booking.status === 'requested' && (
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleBookingResponse(booking.id, 'confirmed')}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleBookingResponse(booking.id, 'declined')}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const [view, setView] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    activeTherapists: 0,
    todaysBookings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [view]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (view === 'bookings') {
        const { data } = await supabase
          .from('bookings')
          .select(`
            *,
            customer:customer_id(name, email),
            therapist:therapist_id(name, email),
            service:service_id(name)
          `)
          .order('created_at', { ascending: false })
          .limit(50);
        
        setBookings(data || []);
      } else if (view === 'users') {
        const { data } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        
        setUsers(data || []);
      } else if (view === 'reports') {
        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        
        const { data: bookingStats } = await supabase
          .from('bookings')
          .select('price, date, status')
          .eq('status', 'confirmed');

        const { data: therapistCount } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'therapist');

        const todaysBookings = bookingStats?.filter(b => b.date === today).length || 0;
        const totalRevenue = bookingStats?.reduce((sum, b) => sum + b.price, 0) || 0;

        setStats({
          totalBookings: bookingStats?.length || 0,
          totalRevenue,
          activeTherapists: therapistCount?.length || 0,
          todaysBookings
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      
      <div className="mb-6">
        <nav className="flex space-x-4">
          <button
            onClick={() => setView('bookings')}
            className={`px-4 py-2 rounded-lg ${
              view === 'bookings' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setView('users')}
            className={`px-4 py-2 rounded-lg ${
              view === 'users' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setView('reports')}
            className={`px-4 py-2 rounded-lg ${
              view === 'reports' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Reports
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <>
          {view === 'bookings' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Therapist</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {booking.date} {booking.time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {booking.customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {booking.therapist.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {booking.service.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          booking.status === 'confirmed' 
                            ? 'bg-green-100 text-green-800'
                            : booking.status === 'requested'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${booking.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'users' && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{user.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'therapist'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'reports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Bookings</p>
                    <p className="text-2xl font-bold">{stats.totalBookings}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">${stats.totalRevenue}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Therapists</p>
                    <p className="text-2xl font-bold">{stats.activeTherapists}</p>
                  </div>
                  <User className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Today's Bookings</p>
                    <p className="text-2xl font-bold">{stats.todaysBookings}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
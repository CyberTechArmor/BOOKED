import { useParams } from 'react-router-dom';

export default function BookingConfirmationPage() {
  const { uid } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="card max-w-lg w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-500 mb-4">
          Your booking has been confirmed.
        </p>
        <p className="text-sm text-gray-400">Booking ID: {uid}</p>
      </div>
    </div>
  );
}

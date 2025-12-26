import { useParams } from 'react-router-dom';

export default function BookingPage() {
  const { orgSlug, eventSlug } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="card max-w-lg w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Book an Appointment</h1>
        <p className="text-gray-500">
          Booking page for {orgSlug}/{eventSlug}
        </p>
      </div>
    </div>
  );
}

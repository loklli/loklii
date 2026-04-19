import { useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo';

export default function SignupChoice() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold mt-6 mb-2">Join Loklii</h1>
      <p className="text-gray-500 text-sm mb-10 text-center">Are you offering a service or looking for one?</p>
      <div className="w-full max-w-sm flex flex-col gap-4">
        <button
          onClick={() => navigate('/host/signup')}
          className="w-full bg-amber text-white font-bold py-5 rounded-2xl text-lg shadow-sm active:scale-95 transition-transform"
        >
          🏠 I'm a Host
          <p className="text-sm font-normal mt-1 opacity-80">Offer services from home</p>
        </button>
        <button
          onClick={() => navigate('/customer/signup')}
          className="w-full bg-teal text-white font-bold py-5 rounded-2xl text-lg shadow-sm active:scale-95 transition-transform"
        >
          🔍 I'm a Customer
          <p className="text-sm font-normal mt-1 opacity-80">Find services near me</p>
        </button>
        <button onClick={() => navigate('/login')} className="text-sm text-gray-500 underline mt-2 text-center">
          Already have an account? Log in
        </button>
      </div>
    </div>
  );
}

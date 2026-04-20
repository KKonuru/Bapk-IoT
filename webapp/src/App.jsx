import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import CalibrationPage from './components/CalibrationPage';

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="loading" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      {!user ? (
        <Login onSignIn={signIn} onSignUp={signUp} />
      ) : (
        <CalibrationPage uid={user.uid} onSignOut={signOut} />
      )}
    </>
  );
}

export default App;

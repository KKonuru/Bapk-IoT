import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import CalibrationPage from './components/CalibrationPage';

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Login onSignIn={signIn} onSignUp={signUp} />;
  }

  return <CalibrationPage uid={user.uid} onSignOut={signOut} />;
}

export default App;

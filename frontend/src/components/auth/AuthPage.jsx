/**
 * Mock Authentication Page
 * Auto-authenticates for development
 */

import React, { useEffect } from 'react';
import { Shield } from 'lucide-react';

const AuthPage = () => {
  // Auto-login after a brief delay
  useEffect(() => {
    // The AuthContext already sets the user, so this page won't be shown for long
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Shield className="h-16 w-16 text-primary animate-pulse mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">SoldierIQ</h2>
        <p className="text-muted-foreground">Authenticating...</p>
      </div>
    </div>
  );
};

export default AuthPage;

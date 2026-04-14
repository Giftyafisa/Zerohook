import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileFeed from './ProfileFeed';

const ProviderClientDiscoveryPage = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const accountType =
    user?.profile_data?.accountType ||
    user?.profileData?.accountType ||
    user?.accountType ||
    user?.account_type ||
    'client';

  if (accountType !== 'provider') {
    return <Navigate to="/profiles" replace />;
  }

  return <ProfileFeed discoverySurface="clients" />;
};

export default ProviderClientDiscoveryPage;
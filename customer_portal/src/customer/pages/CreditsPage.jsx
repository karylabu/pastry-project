import React from 'react';
import { useNavigate } from 'react-router-dom';
import CreditsModal from '../components/CreditsModal';

export default function CreditsPage() {
  const navigate = useNavigate();

  return <CreditsModal isOpen onClose={() => navigate('/customer')} />;
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiAccount } from '@/types';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

interface AccountContextType {
  accounts: ApiAccount[];
  currentAccount: ApiAccount | null;
  setCurrentAccount: (account: ApiAccount | null) => void;
  addAccount: (account: Omit<ApiAccount, 'id' | 'status'>) => void;
  updateAccount: (id: string, updates: Partial<ApiAccount>) => void;
  deleteAccount: (id: string) => void;
  checkAccountStatus: (account: ApiAccount) => Promise<{ success: boolean; message: string }>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const useAccounts = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccounts must be used within an AccountProvider');
  }
  return context;
};

interface AccountProviderProps {
  children: ReactNode;
}

export const AccountProvider: React.FC<AccountProviderProps> = ({ children }) => {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<ApiAccount | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/accounts`);
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
           throw new Error("Backend unreachable (Received HTML). Is server.js running on port 3006?");
        }

        if (!response.ok) throw new Error('Server unreachable');
        const data = await response.json();
        setAccounts(data);
        if (data.length > 0 && !currentAccount) {
          setCurrentAccount(data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    };

    fetchAccounts();
  }, []);

  const addAccount = async (accountData: Omit<ApiAccount, 'id' | 'status'>) => {
    const newAccount: ApiAccount = {
      ...accountData,
      id: crypto.randomUUID(),
      status: 'checking',
    };

    setAccounts(prev => {
        const updated = [...prev, newAccount];
        if (updated.length === 1) setCurrentAccount(newAccount);
        return updated;
    });

    try {
      const response = await fetch(`${apiUrl}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });

      if (!response.ok) throw new Error('Failed to save to server');
      checkAccountStatus(newAccount);

    } catch (error: any) {
      console.error('Failed to persist account:', error);
      updateAccount(newAccount.id, { 
        status: 'disconnected', 
        lastError: { error: "Network Error", details: error.message || "Is the backend server running?" } 
      });
    }
  };

  const updateAccount = async (id: string, updates: Partial<ApiAccount>) => {
    setAccounts(prev => prev.map(acc => (acc.id === id ? { ...acc, ...updates } : acc)));
    if (currentAccount?.id === id) {
      setCurrentAccount(prev => (prev ? { ...prev, ...updates } : null));
    }

    try {
      await fetch(`${apiUrl}/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const deleteAccount = async (id: string) => {
    setAccounts(prev => {
      const remaining = prev.filter(acc => acc.id !== id);
      if (currentAccount?.id === id) setCurrentAccount(remaining[0] || null);
      return remaining;
    });

    try {
      await fetch(`${apiUrl}/api/accounts/${id}`, { method: 'DELETE' });
    } catch (error) { console.error('Delete failed:', error); }
  };

  const checkAccountStatus = async (account: ApiAccount) => {
    updateAccount(account.id, { status: 'checking', lastError: undefined });
    try {
      const response = await fetch(`${apiUrl}/api/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only sending secretKey now
        body: JSON.stringify({ 
          secretKey: account.secretKey 
        }),
      });
      const result = await response.json();
      if (!response.ok) throw result.details || result.message;

      updateAccount(account.id, { 
        status: 'connected', 
        lastChecked: new Date(),
        lastResponse: result.data 
      });
      return { success: true, message: result.message };
    } catch (error: any) {
      updateAccount(account.id, { 
        status: 'disconnected', 
        lastError: error 
      });
      return { success: false, message: "Failed" };
    }
};

  return (
    <AccountContext.Provider value={{ accounts, currentAccount, setCurrentAccount, addAccount, updateAccount, deleteAccount, checkAccountStatus }}>
      {children}
    </AccountContext.Provider>
  );
};
import React, { useState } from 'react';
import { ChevronDown, Plus, Edit, Trash2, Check, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useAccounts } from '../../contexts/AccountContext';
import { cn } from '../../lib/utils';
import { ApiAccount } from '../../types';

interface AccountSelectorProps {
  isCollapsed: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({ isCollapsed }) => {
  const { accounts, currentAccount, setCurrentAccount, addAccount, updateAccount, deleteAccount, checkAccountStatus } = useAccounts();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // State for the Debug Popup
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; type: 'success' | 'error'; data: any }>({ 
    open: false, type: 'success', data: null 
  });

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountSecretKey, setNewAccountSecretKey] = useState('');
  const [newAccountFromEmail, setNewAccountFromEmail] = useState('');
  const [newAccountEventName, setNewAccountEventName] = useState(''); // New State

  const handleStatusCheck = async () => {
    if (!currentAccount) return;
    toast.loading("Checking connection...", { id: "status-check" });
    const result = await checkAccountStatus(currentAccount);
    if (result.success) {
      toast.success("Connected", { id: "status-check", description: result.message });
    } else {
      toast.error("Connection Failed", { id: "status-check", description: "Click the red dot for details" });
    }
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim() || !newAccountSecretKey.trim()) {
      toast.error("Error", { description: "Please fill in Name and Secret Key" });
      return;
    }
    addAccount({ 
      name: newAccountName.trim(), 
      apiKey: "emailit-unused", 
      secretKey: newAccountSecretKey.trim(),
      fromEmail: newAccountFromEmail.trim(),
      defaultEventName: newAccountEventName.trim() // Used as default Audience ID
    });
    setNewAccountName('');
    setNewAccountSecretKey('');
    setNewAccountFromEmail('');
    setNewAccountEventName('');
    setShowAddDialog(false);
    toast.success("Account Added");
  };

  const handleEditAccount = () => {
    if (!currentAccount) return;
    
    const updates: Partial<ApiAccount> = {};
    if (newAccountSecretKey.trim()) updates.secretKey = newAccountSecretKey.trim();
    if (newAccountFromEmail.trim()) updates.fromEmail = newAccountFromEmail.trim();
    if (newAccountEventName.trim()) updates.defaultEventName = newAccountEventName.trim();
    
    updateAccount(currentAccount.id, updates);
    
    setNewAccountSecretKey('');
    setNewAccountFromEmail('');
    setNewAccountEventName('');
    setShowEditDialog(false);
    toast.success("Account Updated");
    
    if (currentAccount && updates.secretKey) {
      checkAccountStatus({ ...currentAccount, ...updates });
    }
  };

  const handleDeleteAccount = () => {
    if (!currentAccount) return;
    deleteAccount(currentAccount.id);
    toast.success("Account Deleted");
  };

  const handleShowDetails = (e: React.MouseEvent, type: 'success' | 'error', data: any) => {
    e.preventDefault();
    e.stopPropagation();
    setStatusDialog({ open: true, type, data });
  };

  const getStatusIcon = (account: ApiAccount | null) => {
    if (!account) return <div className="w-3 h-3 rounded-full bg-muted" />;
    
    const { status, lastError, lastResponse } = account;

    if (status === 'connected') {
      return (
        <button 
          className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 hover:scale-125 transition-all shadow-[0_0_0_2px_rgba(34,197,94,0.2)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500" 
          onClick={(e) => handleShowDetails(e, 'success', lastResponse || { message: "Connected successfully" })}
          title="Connected - Click to view API response"
          type="button"
        />
      );
    }
    
    if (status === 'disconnected') {
      return (
        <button
          className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 hover:scale-125 transition-all shadow-[0_0_0_2px_rgba(239,68,68,0.2)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500" 
          onClick={(e) => handleShowDetails(e, 'error', lastError || { error: "Unknown Error" })}
          title="Disconnected - Click to view Error details"
          type="button"
        />
      );
    }

    return <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_0_2px_rgba(234,179,8,0.2)]" title="Checking status..." />;
  };

  if (accounts.length === 0) {
    return (
      <div className="space-y-2">
        {!isCollapsed && <Label className="text-xs font-medium text-sidebar-accent-foreground">API Account</Label>}
        <Button onClick={() => setShowAddDialog(true)} variant="outline" className={cn("w-full justify-center border-dashed", isCollapsed ? "p-2" : "p-3")}>
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Add Account</span>}
        </Button>
        <AddAccountDialog 
            open={showAddDialog} 
            onOpenChange={setShowAddDialog} 
            name={newAccountName} setName={setNewAccountName} 
            secretKey={newAccountSecretKey} setSecretKey={setNewAccountSecretKey} 
            fromEmail={newAccountFromEmail} setFromEmail={setNewAccountFromEmail}
            eventName={newAccountEventName} setEventName={setNewAccountEventName}
            onAdd={handleAddAccount} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!isCollapsed && <Label className="text-xs font-medium text-sidebar-accent-foreground">API Account</Label>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-between bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent", isCollapsed ? "p-2" : "p-3")}>
            <div className="flex items-center min-w-0 gap-2">
              <div className="shrink-0 flex items-center justify-center" onPointerDown={(e) => e.stopPropagation()}>
                 {getStatusIcon(currentAccount)}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-medium truncate max-w-full">{currentAccount?.name || 'No Account'}</span>
                </div>
              )}
            </div>
            {!isCollapsed && <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accounts.map((account) => (
            <DropdownMenuItem key={account.id} onClick={() => setCurrentAccount(account)} className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", 
                  account.status === 'connected' ? "bg-green-500" : 
                  account.status === 'checking' ? "bg-yellow-500" : "bg-red-500"
                )} />
                <div className="flex flex-col">
                    <span className="truncate max-w-[120px]">{account.name}</span>
                    {(account.fromEmail || account.defaultEventName) && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                        {account.fromEmail ? `From: ${account.fromEmail}` : `Audience: ${account.defaultEventName}`}
                      </span>
                    )}
                </div>
              </div>
              {account.id === currentAccount?.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowAddDialog(true)} className="cursor-pointer"><Plus className="h-4 w-4 mr-2" />Add Account</DropdownMenuItem>
          {currentAccount && (
            <>
              <DropdownMenuItem onClick={() => { 
                setNewAccountSecretKey(currentAccount.secretKey);
                setNewAccountFromEmail(currentAccount.fromEmail || '');
                setNewAccountEventName(currentAccount.defaultEventName || '');
                setShowEditDialog(true); 
              }} className="cursor-pointer"><Edit className="h-4 w-4 mr-2" />Edit Account</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteAccount} className="text-destructive focus:text-destructive cursor-pointer"><Trash2 className="h-4 w-4 mr-2" />Delete Account</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {currentAccount && (
        <Button variant="ghost" className={cn("w-full justify-center text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-8 text-xs", isCollapsed ? "p-2" : "px-3")} onClick={handleStatusCheck}>
          <AlertCircle className="h-3.5 w-3.5" />
          {!isCollapsed && <span className="ml-2">Check Connection</span>}
        </Button>
      )}
      
      <AddAccountDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog} 
        name={newAccountName} setName={setNewAccountName} 
        secretKey={newAccountSecretKey} setSecretKey={setNewAccountSecretKey} 
        fromEmail={newAccountFromEmail} setFromEmail={setNewAccountFromEmail}
        eventName={newAccountEventName} setEventName={setNewAccountEventName}
        onAdd={handleAddAccount} 
      />
      <EditAccountDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
        secretKey={newAccountSecretKey} setSecretKey={setNewAccountSecretKey} 
        fromEmail={newAccountFromEmail} setFromEmail={setNewAccountFromEmail}
        eventName={newAccountEventName} setEventName={setNewAccountEventName}
        onSave={handleEditAccount} 
      />
      
      {/* DEBUG POPUP DIALOG */}
      <Dialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 overflow-hidden border-border">
          <DialogHeader className="p-6 pb-2 border-b bg-muted/30">
            <DialogTitle className={cn("flex items-center gap-2", statusDialog.type === 'success' ? 'text-green-600' : 'text-destructive')}>
              {statusDialog.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {statusDialog.type === 'success' ? 'Connection Successful' : 'Connection Failed'}
            </DialogTitle>
            <DialogDescription>
              Raw server response details for debugging purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-0 bg-[#0d1117]">
            <pre className="p-4 text-[11px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-all">
              {JSON.stringify(statusDialog.data, null, 2)}
            </pre>
          </div>
          <div className="p-4 border-t bg-background flex justify-end">
            <Button variant="outline" onClick={() => setStatusDialog(prev => ({ ...prev, open: false }))}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// UPDATED: Dialog UI labels to "Default Audience ID"
const AddAccountDialog = ({ open, onOpenChange, name, setName, secretKey, setSecretKey, fromEmail, setFromEmail, eventName, setEventName, onAdd }: any) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Add New Account</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
            <Label>Account Name *</Label>
            <Input placeholder="My Emailit Account" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
            <Label>Emailit Secret Key *</Label>
            <Input type="password" placeholder="em_..." value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">Found in Emailit Dashboard &gt; Credentials</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Default "From" (Optional)</Label>
                <Input placeholder="me@example.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
                {/* UPDATED LABEL */}
                <Label>Default Audience ID (Optional)</Label>
                <Input placeholder="aud_xxxxxxxx" value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </div>
        </div>
        <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onAdd}>Add Account</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

// UPDATED: Dialog UI labels to "Default Audience ID"
const EditAccountDialog = ({ open, onOpenChange, secretKey, setSecretKey, fromEmail, setFromEmail, eventName, setEventName, onSave }: any) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
            <Label>Emailit Secret Key</Label>
            <Input type="password" placeholder="em_..." value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Default "From"</Label>
                <Input placeholder="me@example.com" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
                {/* UPDATED LABEL */}
                <Label>Default Audience ID</Label>
                <Input placeholder="aud_xxxxxxxx" value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </div>
        </div>
        <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave}>Save Changes</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
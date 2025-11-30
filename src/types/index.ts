export interface ApiAccount {
  id: string;
  name: string;
  apiKey?: string; 
  secretKey: string;
  fromEmail?: string;
  defaultEventName?: string; // New optional field for default event name
  status: 'connected' | 'disconnected' | 'checking';
  lastChecked?: Date;
  lastError?: any;
  lastResponse?: any;
  jobProgress?: { processed: number; total: number; isRunning: boolean; };
}

export interface Subscriber {
  id: string;
  email: string;
  subscriptionDate: Date;
  status: 'active' | 'unsubscribed' | 'bounced';
}

export interface BulkJobResult {
  id: string;
  email: string;
  status: 'success' | 'failed';
  timestamp: Date;
  response: any;
}

export interface BulkJob {
  accountId: string;
  emails: string[];
  tags?: string[];
  welcomeEmail?: string;
  delay: number;
  results: BulkJobResult[];
  startTime?: Date;
  endTime?: Date;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';
  currentIndex: number;
}

export interface EmailAnalytics {
  emailId: string;
  emailSubject: string;
  recipients: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  events: EmailEvent[];
}

export interface EmailEvent {
  id: string;
  type: 'sent' | 'opened' | 'clicked' | 'unsubscribed' | 'bounced';
  email: string;
  timestamp: Date;
  metadata?: any;
}
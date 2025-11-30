import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

export interface SendResult {
  id: number;
  email: string;
  status: 'success' | 'error';
  response: string;
}

export interface JobState {
  // Inputs
  emailList: string;
  subject: string;
  content: string;
  fromEmail?: string;
  fromName?: string; // NEW: Added fromName
  delay: number;
  
  // Job Status
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'stopped' | 'waiting';
  progress: { current: number; total: number };
  results: SendResult[];
  
  // Stats
  stats: { success: number; fail: number };
  elapsedSeconds: number;
  countdown: number;
}

interface BulkJobContextType {
  jobs: Record<string, JobState>;
  updateJobData: (accountId: string, data: Partial<JobState>) => void;
  startJob: (accountId: string, accountData: { apiKey: string; secretKey: string }) => Promise<void>;
  pauseJob: (accountId: string) => void;
  resumeJob: (accountId: string) => void;
  stopJob: (accountId: string) => void;
  getJob: (accountId: string) => JobState;
}

const BulkJobContext = createContext<BulkJobContextType | undefined>(undefined);

export const useBulkJobs = () => {
  const context = useContext(BulkJobContext);
  if (!context) throw new Error('useBulkJobs must be used within a BulkJobProvider');
  return context;
};

const defaultJobState: JobState = {
  emailList: '',
  subject: '',
  content: '',
  fromEmail: '',
  fromName: '', // NEW
  delay: 1,
  status: 'idle',
  progress: { current: 0, total: 0 },
  results: [],
  stats: { success: 0, fail: 0 },
  elapsedSeconds: 0,
  countdown: 0,
};

export const BulkJobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const controllers = useRef<Record<string, { isPaused: boolean; isStopped: boolean }>>({});

  const getJob = (accountId: string) => jobs[accountId] || { ...defaultJobState };

  const updateJobData = (accountId: string, data: Partial<JobState>) => {
    setJobs(prev => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || defaultJobState), ...data }
    }));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(currentJobs => {
        const nextJobs = { ...currentJobs };
        let hasChanges = false;

        Object.keys(nextJobs).forEach(accId => {
          if (nextJobs[accId].status === 'processing' || nextJobs[accId].status === 'waiting') {
            nextJobs[accId] = {
              ...nextJobs[accId],
              elapsedSeconds: nextJobs[accId].elapsedSeconds + 1
            };
            hasChanges = true;
          }
        });

        return hasChanges ? nextJobs : currentJobs;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const pauseJob = (accountId: string) => {
    if (controllers.current[accountId]) {
      controllers.current[accountId].isPaused = true;
      updateJobData(accountId, { status: 'paused' });
      toast.info("Job Paused");
    }
  };

  const resumeJob = (accountId: string) => {
    if (controllers.current[accountId]) {
      controllers.current[accountId].isPaused = false;
      updateJobData(accountId, { status: 'processing' });
      toast.info("Job Resumed");
    }
  };

  const stopJob = (accountId: string) => {
    if (controllers.current[accountId]) {
      controllers.current[accountId].isStopped = true;
      controllers.current[accountId].isPaused = false; 
      updateJobData(accountId, { status: 'stopped' });
    }
  };

  const startJob = async (accountId: string, accountData: { apiKey: string; secretKey: string }) => {
    const job = getJob(accountId);
    const emails = job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0);

    if (emails.length === 0) {
      toast.error("No emails found");
      return;
    }
    if (!job.subject || !job.content) {
      toast.error("Missing subject or content");
      return;
    }

    controllers.current[accountId] = { isPaused: false, isStopped: false };

    updateJobData(accountId, {
      status: 'processing',
      results: [],
      stats: { success: 0, fail: 0 },
      progress: { current: 0, total: emails.length },
      elapsedSeconds: 0,
      countdown: 0
    });

    toast.success("Job Started");

    for (let i = 0; i < emails.length; i++) {
      const ctrl = controllers.current[accountId];

      if (ctrl?.isStopped) {
        updateJobData(accountId, { status: 'stopped' });
        break;
      }

      while (ctrl?.isPaused) {
        if (ctrl?.isStopped) break;
        await new Promise(r => setTimeout(r, 500));
      }
      if (ctrl?.isStopped) break;

      if (i > 0 && job.delay > 0) {
         let remaining = job.delay;
         updateJobData(accountId, { status: 'waiting', countdown: remaining });
         
         while (remaining > 0) {
            if (ctrl?.isStopped) break;
            while (ctrl?.isPaused) {
                if (ctrl?.isStopped) break;
                await new Promise(r => setTimeout(r, 500));
            }

            await new Promise(r => setTimeout(r, 1000));
            remaining--;
            updateJobData(accountId, { countdown: remaining });
         }
         updateJobData(accountId, { status: 'processing', countdown: 0 });
      }

      if (ctrl?.isStopped) {
        updateJobData(accountId, { status: 'stopped' });
        break;
      }

      const email = emails[i];
      const id = i + 1;

      try {
        const response = await fetch(`${apiUrl}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            to: email,
            subject: getJob(accountId).subject,
            content: getJob(accountId).content,
            fromEmail: job.fromEmail, // Updated: Send separately
            fromName: job.fromName    // Updated: Send separately
          }),
        });

        const resultData = await response.json();
        const status = response.ok ? 'success' : 'error';

        setJobs(prev => {
            const currentJob = prev[accountId];
            const newStats = { ...currentJob.stats };
            if (status === 'success') newStats.success++;
            else newStats.fail++;

            return {
                ...prev,
                [accountId]: {
                    ...currentJob,
                    stats: newStats,
                    progress: { ...currentJob.progress, current: id },
                    results: [
                        { id, email, status, response: JSON.stringify(resultData, null, 2) },
                        ...currentJob.results
                    ]
                }
            };
        });

      } catch (error: any) {
        setJobs(prev => {
            const currentJob = prev[accountId];
            return {
                ...prev,
                [accountId]: {
                    ...currentJob,
                    stats: { ...currentJob.stats, fail: currentJob.stats.fail + 1 },
                    progress: { ...currentJob.progress, current: id },
                    results: [
                        { 
                            id, 
                            email, 
                            status: 'error', 
                            response: JSON.stringify({ error: error.message || "Network Error" }, null, 2) 
                        },
                        ...currentJob.results
                    ]
                }
            };
        });
      }
    }

    if (!controllers.current[accountId]?.isStopped) {
      updateJobData(accountId, { status: 'completed' });
      toast.success("Job Completed");
    }
  };

  return (
    <BulkJobContext.Provider value={{ jobs, updateJobData, startJob, pauseJob, resumeJob, stopJob, getJob }}>
      {children}
    </BulkJobContext.Provider>
  );
};
import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

export interface TrackResult {
  id: number;
  email: string;
  status: 'success' | 'error';
  response: string;
}

export interface TrackJobState {
  emailList: string;
  eventName: string;
  eventData: string;
  delay: number; // Added
  
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'stopped' | 'waiting'; // Added waiting
  progress: { current: number; total: number };
  results: TrackResult[];
  
  stats: { success: number; fail: number };
  elapsedSeconds: number;
  countdown: number; // Added
}

interface TrackEventContextType {
  jobs: Record<string, TrackJobState>;
  updateJobData: (accountId: string, data: Partial<TrackJobState>) => void;
  startJob: (accountId: string) => Promise<void>;
  pauseJob: (accountId: string) => void;
  resumeJob: (accountId: string) => void;
  stopJob: (accountId: string) => void;
  getJob: (accountId: string) => TrackJobState;
}

const TrackEventContext = createContext<TrackEventContextType | undefined>(undefined);

export const useTrackEvents = () => {
  const context = useContext(TrackEventContext);
  if (!context) throw new Error('useTrackEvents must be used within a TrackEventProvider');
  return context;
};

const defaultJobState: TrackJobState = {
  emailList: '',
  eventName: '',
  eventData: '{}',
  delay: 1,
  status: 'idle',
  progress: { current: 0, total: 0 },
  results: [],
  stats: { success: 0, fail: 0 },
  elapsedSeconds: 0,
  countdown: 0,
};

export const TrackEventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Record<string, TrackJobState>>({});
  const controllers = useRef<Record<string, { isPaused: boolean; isStopped: boolean }>>({});

  const getJob = (accountId: string) => jobs[accountId] || { ...defaultJobState };

  const updateJobData = (accountId: string, data: Partial<TrackJobState>) => {
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
      toast.info("Tracking Paused");
    }
  };

  const resumeJob = (accountId: string) => {
    if (controllers.current[accountId]) {
      controllers.current[accountId].isPaused = false;
      updateJobData(accountId, { status: 'processing' });
      toast.info("Tracking Resumed");
    }
  };

  const stopJob = (accountId: string) => {
    if (controllers.current[accountId]) {
      controllers.current[accountId].isStopped = true;
      controllers.current[accountId].isPaused = false; 
      updateJobData(accountId, { status: 'stopped' });
    }
  };

  const startJob = async (accountId: string) => {
    const job = getJob(accountId);
    const emails = job.emailList.split('\n').map(e => e.trim()).filter(e => e.length > 0);

    if (emails.length === 0) {
      toast.error("No emails found");
      return;
    }
    if (!job.eventName) {
      toast.error("Event Name is required");
      return;
    }

    let parsedData = {};
    try {
        parsedData = JSON.parse(job.eventData || '{}');
    } catch (e) {
        toast.error("Invalid JSON in Event Data");
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

    toast.success("Tracking Started");

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

      // --- DELAY LOGIC ---
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

      if (ctrl?.isStopped) break;

      const email = emails[i];
      const id = i + 1;

      try {
        const response = await fetch(`${apiUrl}/api/track-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId,
            event: job.eventName,
            email: email,
            data: parsedData,
            subscribed: true 
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
      toast.success("Tracking Completed");
    }
  };

  return (
    <TrackEventContext.Provider value={{ jobs, updateJobData, startJob, pauseJob, resumeJob, stopJob, getJob }}>
      {children}
    </TrackEventContext.Provider>
  );
};
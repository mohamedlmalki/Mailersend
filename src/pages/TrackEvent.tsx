import React, { useState, useEffect } from 'react';
import { 
  Activity, Info, CheckCircle2, XCircle, Loader2, 
  Pause, Play, Square, Clock, Check, AlertTriangle,
  Download, Filter, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from '@/contexts/AccountContext';
import { useTrackEvents } from '@/contexts/TrackEventContext';
import { toast } from 'sonner';

export const TrackEvent: React.FC = () => {
  const { currentAccount } = useAccounts();
  const { getJob, updateJobData, startJob, pauseJob, resumeJob, stopJob } = useTrackEvents();
  
  const job = currentAccount ? getJob(currentAccount.id) : null;

  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean, data: string | null }>({ open: false, data: null });

  useEffect(() => {
    if (currentAccount && job && !job.eventName) {
      if (currentAccount.defaultEventName) {
        updateJobData(currentAccount.id, { eventName: currentAccount.defaultEventName });
      }
    }
  }, [currentAccount, job?.eventName]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredResults = job ? job.results.filter(result => {
    if (filter === 'all') return true;
    return result.status === filter;
  }) : [];

  const handleExport = () => {
    if (filteredResults.length === 0) {
      toast.error("No logs to export");
      return;
    }
    const textContent = filteredResults.map(r => `${r.email},${r.status}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audience-logs-${filter}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredResults.length} logs`);
  };

  const onStart = () => {
    if (!currentAccount) return;
    startJob(currentAccount.id);
  };

  const onPauseToggle = () => {
    if (!currentAccount || !job) return;
    if (job.status === 'paused') resumeJob(currentAccount.id);
    else pauseJob(currentAccount.id);
  };

  const onStop = () => {
    if (!currentAccount) return;
    stopJob(currentAccount.id);
  };

  if (!currentAccount || !job) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No Account Selected</h2>
            <p className="text-muted-foreground">Select an Emailit account to add subscribers.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isJobActive = job.status === 'processing' || job.status === 'paused' || job.status === 'waiting';

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-colored">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Add to Audience</h1>
          <p className="text-muted-foreground">Account: <span className="font-semibold text-primary">{currentAccount.name}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Card */}
        <Card className="lg:col-span-1 h-fit shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Target Audience & Data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    {/* UPDATED: Label changed from Event Name to Audience ID */}
                    <Label>Audience ID</Label>
                    <Input 
                        placeholder="aud_xxxxxxxx" 
                        value={job.eventName}
                        onChange={(e) => updateJobData(currentAccount.id, { eventName: e.target.value })}
                        disabled={isJobActive}
                        className="h-9 text-xs"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="delay" className="flex items-center gap-2">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground" /> Delay (sec)
                    </Label>
                    <Input 
                        id="delay" 
                        type="number"
                        min="0"
                        value={job.delay}
                        onChange={(e) => updateJobData(currentAccount.id, { delay: parseInt(e.target.value) || 0 })}
                        disabled={isJobActive}
                        className="h-9 text-xs"
                    />
                </div>
            </div>

            <div className="space-y-2">
              {/* UPDATED: Label changed from Metadata to Custom Fields */}
              <Label>Custom Fields (JSON)</Label>
              <Textarea 
                placeholder='{ "role": "developer", "plan": "pro" }'
                className="font-mono text-xs min-h-[80px]"
                value={job.eventData}
                onChange={(e) => updateJobData(currentAccount.id, { eventData: e.target.value })}
                disabled={isJobActive}
              />
            </div>

            <div className="space-y-2">
              <Label>Subscriber Emails</Label>
              <Textarea 
                placeholder={`user1@example.com\nuser2@example.com`}
                className="min-h-[200px] font-mono text-xs leading-relaxed"
                value={job.emailList}
                onChange={(e) => updateJobData(currentAccount.id, { emailList: e.target.value })}
                disabled={isJobActive}
              />
              <p className="text-[10px] text-muted-foreground">Enter one email per line.</p>
            </div>

            {!isJobActive ? (
                <Button 
                  className="w-full bg-gradient-primary shadow-colored" 
                  onClick={onStart}
                >
                  <Activity className="w-4 h-4 mr-2" /> 
                  {job.status === 'completed' || job.status === 'stopped' ? "Restart Process" : "Start Adding"}
                </Button>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <Button 
                        variant={job.status === 'paused' ? "default" : "secondary"}
                        className={job.status === 'paused' ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}
                        onClick={onPauseToggle}
                    >
                        {job.status === 'paused' ? (
                            <> <Play className="w-4 h-4 mr-2" /> Resume </>
                        ) : (
                            <> <Pause className="w-4 h-4 mr-2" /> Pause </>
                        )}
                    </Button>
                    
                    <Button 
                        variant="destructive"
                        onClick={onStop}
                    >
                        <Square className="w-4 h-4 mr-2 fill-current" /> Stop
                    </Button>
                    
                    <div className="col-span-2 flex items-center justify-center text-xs text-muted-foreground mt-2">
                         {job.status === 'waiting' ? (
                            <span className="flex items-center text-blue-500 font-semibold animate-pulse">
                                <Timer className="w-3 h-3 mr-2" /> Next request in {job.countdown}s...
                            </span>
                        ) : (
                             <span className="flex items-center animate-pulse">
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" /> 
                                {job.status === 'paused' ? "Paused" : "Processing"}
                             </span>
                        )}
                    </div>
                </div>
            )}

          </CardContent>
        </Card>

        {/* Results Card */}
        <Card className="lg:col-span-2 shadow-md min-h-[500px] flex flex-col border-t-4 border-t-secondary">
           <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle>Live Results</CardTitle>
                    <CardDescription>Real-time status</CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                     <div className="flex items-center space-x-2 p-2 rounded-lg border border-border/50 mr-2">
                        <div className="flex items-center px-3 py-1 border-r border-border/50">
                            <div className="text-xs text-muted-foreground mr-2 uppercase tracking-wider font-semibold">Time</div>
                            <Clock className="w-4 h-4 mr-1.5 text-blue-500" />
                            <span className="font-mono font-medium">{formatTime(job.elapsedSeconds)}</span>
                        </div>
                        <div className="flex items-center px-3 py-1 border-r border-border/50">
                            <div className="text-xs text-muted-foreground mr-2 uppercase tracking-wider font-semibold">Done</div>
                            <span className="font-mono font-medium">{job.progress.current} / {job.progress.total}</span>
                        </div>
                        <div className="flex items-center px-3 py-1 border-r border-border/50">
                            <div className="text-xs text-muted-foreground mr-2 uppercase tracking-wider font-semibold">OK</div>
                            <Check className="w-4 h-4 mr-1.5 text-green-500" />
                            <span className="font-mono font-medium text-green-600 dark:text-green-400">{job.stats.success}</span>
                        </div>
                        <div className="flex items-center px-3 py-1">
                            <div className="text-xs text-muted-foreground mr-2 uppercase tracking-wider font-semibold">Fail</div>
                            <AlertTriangle className="w-4 h-4 mr-1.5 text-red-500" />
                            <span className="font-mono font-medium text-red-600 dark:text-red-400">{job.stats.fail}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md bg-background">
                            <div className="px-2 border-r text-muted-foreground"><Filter className="w-3.5 h-3.5" /></div>
                            <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
                                <SelectTrigger className="h-8 w-[100px] border-0 focus:ring-0 bg-transparent">
                                    <SelectValue placeholder="Filter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="error">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                        </Button>
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
             <div className="h-[600px] overflow-y-auto relative">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[50px] text-center">#</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                    <TableHead className="w-[50px] text-center">Log</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-40 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-2 opacity-50">
                            <Activity className="w-8 h-8" />
                            <span>No results match filter.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((result) => (
                      <TableRow key={result.id} className="animate-in slide-in-from-top-2 fade-in duration-300">
                        <TableCell className="font-mono text-muted-foreground text-center">{result.id}</TableCell>
                        <TableCell className="font-medium font-mono text-xs">{result.email}</TableCell>
                        <TableCell className="text-center">
                          {result.status === 'success' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              <XCircle className="w-3 h-3 mr-1" /> Failed
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => setDetailsDialog({ open: true, data: result.response })}
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Response Details</DialogTitle>
            <DialogDescription>Raw server response.</DialogDescription>
          </DialogHeader>
          <div className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[400px] font-mono text-xs border border-slate-800">
            <pre>{detailsDialog.data}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
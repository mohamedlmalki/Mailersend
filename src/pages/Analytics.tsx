import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, RefreshCw, AlertCircle, CheckCircle2, XCircle, 
  Clock, Mail, ChevronLeft, ChevronRight, MoreHorizontal,
  MailOpen, MousePointer2, Ban, Hourglass, Download, Filter
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAccounts } from '@/contexts/AccountContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

interface EmailLog {
  id: string;
  type: string;
  to: string;
  from: string;
  subject: string;
  status: 'delivered' | 'failed' | 'processing' | 'opened' | 'clicked' | 'spam' | 'delayed';
  detailedStatus: string;
  errorMessage: string | null;
  sentAt: string;
}

export const Analytics: React.FC = () => {
  const { currentAccount } = useAccounts();
  
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Simple client-side stats based on loaded data
  const stats = useMemo(() => {
    return {
      delivered: logs.filter(l => l.status === 'delivered').length,
      failed: logs.filter(l => l.status === 'failed').length,
      opened: logs.filter(l => l.status === 'opened').length,
      clicked: logs.filter(l => l.status === 'clicked').length,
      issues: logs.filter(l => l.status === 'spam' || l.status === 'delayed').length
    };
  }, [logs]);

  const handleExport = () => {
    if (logs.length === 0) {
      toast.error("No logs to export");
      return;
    }
    const textContent = logs.map(r => `${r.sentAt},${r.to},${r.detailedStatus}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${logs.length} logs`);
  };

  const fetchLogs = async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    try {
      // Construct query params
      const params = new URLSearchParams({
        accountId: currentAccount.id,
        limit: '25',
        page: page.toString()
      });
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${apiUrl}/api/email/log?${params.toString()}`);
      const result = await response.json();
      
      if (response.status === 401) {
        toast.error("Unauthorized: Please check your API Key");
        setLogs([]);
        return;
      }

      if (result.success) {
        setLogs(result.data);
      } else {
        toast.error("Failed to fetch data");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentAccount, page, statusFilter]);

  const getStatusBadge = (log: EmailLog) => {
    switch (log.status) {
      case 'delivered':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Sent</Badge>;
      case 'opened':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><MailOpen className="w-3 h-3 mr-1" /> Opened</Badge>;
      case 'clicked':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><MousePointer2 className="w-3 h-3 mr-1" /> Clicked</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> {log.detailedStatus}</Badge>;
      case 'spam':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><Ban className="w-3 h-3 mr-1" /> Held/Spam</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> {log.detailedStatus}</Badge>;
    }
  };

  if (!currentAccount) {
     return <div className="p-10 text-center">Please select an account.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-colored">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground text-sm">Account: {currentAccount.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
             <Select value={statusFilter} onValueChange={(val) => { setPage(1); setStatusFilter(val); }}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="delivered">Sent</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="clicked">Clicked</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Sent" value={stats.delivered} icon={CheckCircle2} color="text-green-600" />
        <StatCard title="Opens" value={stats.opened} icon={MailOpen} color="text-blue-600" />
        <StatCard title="Clicks" value={stats.clicked} icon={MousePointer2} color="text-purple-600" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="text-red-600" />
        <StatCard title="Issues" value={stats.issues} icon={AlertCircle} color="text-orange-600" />
      </div>

      {/* Table Section */}
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-0">
          <div className="rounded-md">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[160px]">Event</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No events found.</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell>{getStatusBadge(log)}</TableCell>
                      <TableCell className="font-mono text-xs">{log.to}</TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]">{log.subject}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(log.sentAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Simple Pagination */}
          <div className="flex items-center justify-end p-4 space-x-2 border-t bg-muted/10">
             <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
             </Button>
             <span className="text-xs font-medium">Page {page}</span>
             <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < 25}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
             </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Event Details</DialogTitle>
                <DialogDescription className="font-mono text-xs">{selectedLog?.id}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground text-xs uppercase font-semibold">Recipient</span>
                        <p className="font-medium font-mono bg-muted/50 p-1 rounded">{selectedLog?.to}</p>
                    </div>
                    <div>
                         <span className="text-muted-foreground text-xs uppercase font-semibold">From</span>
                        <p className="font-medium font-mono bg-muted/50 p-1 rounded">{selectedLog?.from}</p>
                    </div>
                </div>

                <div>
                    <span className="text-muted-foreground text-xs uppercase font-semibold">Subject</span>
                    <p className="text-sm border-b pb-2">{selectedLog?.subject}</p>
                </div>
                
                {selectedLog?.errorMessage && (
                    <div className="p-3 bg-red-50 text-red-800 rounded-md border border-red-200 text-xs font-mono break-all">
                        <span className="font-bold">Error: </span>{selectedLog.errorMessage}
                    </div>
                )}

                <div className="pt-2 text-xs text-muted-foreground flex justify-between items-center">
                    <Badge variant="secondary" className="font-mono">{selectedLog?.type}</Badge>
                    <span>{selectedLog && format(new Date(selectedLog.sentAt), 'PPpp')}</span>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <Card className="bg-muted/30 border-none shadow-sm">
    <CardContent className="p-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
      <Icon className={`w-6 h-6 opacity-80 ${color}`} />
    </CardContent>
  </Card>
);
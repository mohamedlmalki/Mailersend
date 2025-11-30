import React, { useState, useRef, useEffect } from 'react';
import { Send, Mail, Type, FileText, Image as ImageIcon, Eye, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from '@/contexts/AccountContext';
import { toast } from 'sonner';

const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

export const AddSubscriber: React.FC = () => {
  const { currentAccount } = useAccounts();
  
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState(''); 
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState('');

  // Image Dialog State
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [imageSize, setImageSize] = useState('100%');
  const [imageAlign, setImageAlign] = useState('center');

  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Load default From address when account changes
  useEffect(() => {
    if (currentAccount?.fromEmail) {
      setFromAddress(currentAccount.fromEmail);
    } else {
      setFromAddress('');
    }
  }, [currentAccount]);

  const handleInsertImage = () => {
    if (!imageUrl) {
        toast.error("Image URL is required");
        return;
    }

    // Build the HTML
    let imgTag = `<img src="${imageUrl}" alt="Image" style="max-width: 100%; width: ${imageSize}; height: auto;" />`;
    
    if (imageLink) {
        imgTag = `<a href="${imageLink}" target="_blank">${imgTag}</a>`;
    }

    const wrapper = `<div style="text-align: ${imageAlign}; margin: 10px 0;">${imgTag}</div>`;

    // Insert at cursor position if possible, otherwise append
    if (contentRef.current) {
        const start = contentRef.current.selectionStart;
        const end = contentRef.current.selectionEnd;
        const newContent = content.substring(0, start) + wrapper + content.substring(end);
        setContent(newContent);
    } else {
        setContent(prev => prev + wrapper);
    }

    // Reset fields and close dialog
    setImageUrl('');
    setImageLink('');
    setImageSize('100%');
    setImageAlign('center');
    setIsImageDialogOpen(false);
    toast.success("Image HTML added to content");
  };

  const handleSendEmail = async () => {
    setLastResponse(''); 

    if (!currentAccount) {
      toast.error("No Account", { description: "Please select an account first." });
      return;
    }
    if (!to || !subject || !content) {
      toast.error("Missing Fields", { description: "Please fill in To, Subject, and Content." });
      return;
    }

    setIsSending(true);
    const toastId = toast.loading("Sending email...");

    try {
      const response = await fetch(`${apiUrl}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          to,
          subject,
          content,
          fromEmail: fromAddress, // Updated: Send separately
          fromName: fromName      // Updated: Send separately
        }),
      });

      const result = await response.json();
      setLastResponse(JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to send');
      }

      toast.success("Email Sent", { 
        id: toastId, 
        description: `Successfully sent to ${to}` 
      });
      
      setTo('');
      setSubject('');
      setContent('');

    } catch (error: any) {
      toast.error("Send Failed", { 
        id: toastId, 
        description: error.message || "Check connection settings" 
      });
      if (!lastResponse) {
         setLastResponse(JSON.stringify(error, null, 2));
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!currentAccount) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">No Account Selected</h2>
            <p className="text-muted-foreground">Select an account to start sending emails.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center space-x-3 animate-slide-up">
        <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-colored">
          <Send className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Send Email</h1>
          <p className="text-muted-foreground">Send transactional emails via MailerSend</p>
        </div>
      </div>

      <Card className="hover-lift animate-scale-in shadow-lg border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle>Compose Message</CardTitle>
          <CardDescription>Sending from: <span className="font-semibold text-primary">{currentAccount.name}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="fromName" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" /> From Name
                </Label>
                <Input 
                id="fromName" 
                placeholder="My Company" 
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="from" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> From Email
                </Label>
                <Input 
                id="from" 
                placeholder="marketing@example.com" 
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                />
            </div>
          </div>

          <div className="space-y-2">
                <Label htmlFor="to" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> To
                </Label>
                <Input 
                id="to" 
                placeholder="user@example.com" 
                value={to}
                onChange={(e) => setTo(e.target.value)}
                />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject" className="flex items-center gap-2">
              <Type className="w-4 h-4 text-muted-foreground" /> Subject
            </Label>
            <Input 
              id="subject" 
              placeholder="Welcome to our service!" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label htmlFor="content" className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Content (HTML)
                </Label>
                <div className="flex space-x-2">
                    {/* Add Image Dialog */}
                    <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Add Image
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Insert Image</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Image URL</Label>
                                    <Input 
                                        placeholder="https://example.com/image.jpg" 
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Link URL (Optional)</Label>
                                    <Input 
                                        placeholder="https://google.com" 
                                        value={imageLink}
                                        onChange={(e) => setImageLink(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Size</Label>
                                        <Input 
                                            placeholder="100%, 300px..." 
                                            value={imageSize}
                                            onChange={(e) => setImageSize(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Alignment</Label>
                                        <Select value={imageAlign} onValueChange={setImageAlign}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="left">Left</SelectItem>
                                                <SelectItem value="center">Center</SelectItem>
                                                <SelectItem value="right">Right</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={handleInsertImage} className="mt-2">Save & Insert</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Preview Dialog */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Email Preview</DialogTitle>
                            </DialogHeader>
                            <div className="border rounded-md p-4 mt-2 min-h-[200px] prose max-w-none dark:prose-invert bg-white dark:bg-black">
                                {content ? (
                                    <div dangerouslySetInnerHTML={{ __html: content }} />
                                ) : (
                                    <p className="text-muted-foreground italic text-center">No content to preview</p>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <Textarea 
              ref={contentRef}
              id="content" 
              placeholder="<h1>Hello!</h1><p>This is a test email...</p>" 
              className="min-h-[200px] font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Original Response Debug Area */}
          {lastResponse && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="response" className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" /> Original Response
              </Label>
              <Textarea 
                id="response" 
                readOnly
                className="min-h-[150px] font-mono text-xs bg-muted/50"
                value={lastResponse}
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSendEmail} 
              disabled={isSending}
              size="lg"
              className="bg-gradient-primary w-full sm:w-auto shadow-colored"
            >
              {isSending ? "Sending..." : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Send Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
import React from 'react';
import { Link, useLocation } from 'wouter';
import { Send, Users, UsersRound, BarChart3, Menu, X, Mail, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountSelector } from '@/components/account/AccountSelector';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navigationItems = [
  {
    title: 'Send Email',
    href: '/add-subscriber',
    icon: Send,
    description: 'Send transactional emails'
  },
  {
    title: 'Bulk Send',
    href: '/bulk-import',
    icon: UsersRound,
    description: 'Bulk Send emails'
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'View reports'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const [location] = useLocation();

  return (
    <div className={cn("h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col", isCollapsed ? "w-16" : "w-64")}>
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-primary rounded-xl flex items-center justify-center shadow-colored">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-inter font-bold text-sidebar-foreground tracking-tight">Relay</h1>
                <p className="text-xs text-sidebar-accent-foreground font-medium">Manager</p>
              </div>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0 hover:bg-sidebar-accent">
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="p-4 border-b border-sidebar-border">
        <AccountSelector isCollapsed={isCollapsed} />
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start text-left font-normal transition-all duration-300",
                    isCollapsed ? "p-2" : "p-3",
                    isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg" : "hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className={cn("shrink-0", isCollapsed ? "h-4 w-4" : "h-4 w-4 mr-3")} />
                  {!isCollapsed && (
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs opacity-75">{item.description}</span>
                    </div>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && <div className="text-xs text-sidebar-accent-foreground">v2.0 Plunk</div>}
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};
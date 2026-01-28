'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  ClipboardList,
  Database,
  Upload,
  Settings,
  ScrollText,
  LogOut,
  Shield,
  Search,
  Building2,
  Sparkles,
  FileBarChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { QuickVerifyDialog } from '@/components/verification/quick-verify-dialog';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, badge: null },
  { name: 'People', href: '/people', icon: Users, badge: null },
  { name: 'Licenses', href: '/licenses', icon: FileCheck, badge: null },
  { name: 'Tasks', href: '/tasks', icon: ClipboardList, badge: null },
  { name: 'Verifications', href: '/verifications', icon: Shield, badge: null },
  { name: 'Reports', href: '/reports', icon: FileBarChart, badge: null },
  { name: 'Import', href: '/imports', icon: Upload, badge: null },
];

const adminNavigation = [
  { name: 'Facilities', href: '/facilities', icon: Building2 },
  { name: 'Sources', href: '/sources', icon: Database },
  { name: 'Audit Log', href: '/audit', icon: ScrollText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, logout } = useUser();
  const router = useRouter();
  const [quickVerifyOpen, setQuickVerifyOpen] = useState(false);

  return (
    <div className="flex h-full w-60 flex-col border-r border-border/40 bg-background/95 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2 px-5 border-b border-border/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Cascadia</span>
      </div>

      {/* Quick Verify Button */}
      {isAdmin && (
        <div className="px-3 py-3">
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm"
            size="sm"
            onClick={() => setQuickVerifyOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Quick Verify
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-1 flex-col px-3 py-2 overflow-y-auto">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-6">
            <div className="mb-2 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Admin
              </span>
            </div>
            <div className="space-y-1">
              {adminNavigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{item.name}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sign out */}
        <div className="border-t border-border/40 pt-3 mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </nav>

      <QuickVerifyDialog
        open={quickVerifyOpen}
        onOpenChange={setQuickVerifyOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { QuickVerifyDialog } from '@/components/verification/quick-verify-dialog';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'People', href: '/people', icon: Users },
  { name: 'Licenses', href: '/licenses', icon: FileCheck },
  { name: 'Tasks', href: '/tasks', icon: ClipboardList },
  { name: 'Verifications', href: '/verifications', icon: Shield },
  { name: 'Import', href: '/imports', icon: Upload },
];

const adminNavigation = [
  { name: 'Facilities', href: '/facilities', icon: Building2 },
  { name: 'Sources', href: '/sources', icon: Database },
  { name: 'Audit Log', href: '/audit', icon: ScrollText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, isAdmin } = useUser();
  const router = useRouter();
  const [quickVerifyOpen, setQuickVerifyOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <h1 className="text-xl font-bold text-white">Cascadia</h1>
      </div>

      {/* Quick Verify Button */}
      {isAdmin && (
        <div className="px-3 pb-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setQuickVerifyOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Quick Verify
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-1 flex-col px-3 py-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {item.name}
                </Link>
              </li>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <li className="mt-6">
                <div className="text-xs font-semibold leading-6 text-gray-500 px-3">
                  Admin
                </div>
              </li>
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </>
          )}
        </ul>

        {/* User info and sign out */}
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-white truncate">
              {profile?.full_name || profile?.email}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {profile?.role}
            </p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-x-3 px-3 text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
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

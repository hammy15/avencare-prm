'use client';

import { useUser } from '@/hooks/use-user';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const { profile } = useUser();

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {actions}
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
              {profile?.full_name
                ? getInitials(
                    profile.full_name.split(' ')[0] || '',
                    profile.full_name.split(' ')[1] || ''
                  )
                : profile?.email?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

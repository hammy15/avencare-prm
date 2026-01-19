import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatName } from '@/lib/utils';
import type { VerificationTask, License, Person, VerificationSource } from '@/types/database';
import { ClipboardList } from 'lucide-react';

interface PendingTasksProps {
  tasks: (VerificationTask & {
    license: License & { person: Person };
    source: VerificationSource | null;
  })[];
}

export function PendingTasks({ tasks }: PendingTasksProps) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pending Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No pending verification tasks.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Pending Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0"
            >
              <div className="space-y-1">
                <Link
                  href={`/tasks/${task.id}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {task.license?.person
                    ? formatName(task.license.person.first_name, task.license.person.last_name)
                    : 'Unknown'}
                </Link>
                <p className="text-sm text-gray-500">
                  {task.license?.credential_type} - {task.license?.state}
                  {task.source && ` via ${task.source.display_name}`}
                </p>
              </div>
              <div className="text-right">
                {task.due_date && (
                  <p className="text-sm text-gray-600">
                    Due: {formatDate(task.due_date)}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Priority: {task.priority}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/tasks"
          className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-700"
        >
          View all tasks
        </Link>
      </CardContent>
    </Card>
  );
}

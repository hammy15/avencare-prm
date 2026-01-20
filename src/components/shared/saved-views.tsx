'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Bookmark,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
  createdAt: string;
}

interface SavedViewsProps {
  views: SavedView[];
  currentFilters: Record<string, unknown>;
  activeViewId?: string;
  onViewSelect: (view: SavedView) => void;
  onViewSave: (name: string, filters: Record<string, unknown>) => Promise<void>;
  onViewDelete: (viewId: string) => Promise<void>;
  onSetDefault?: (viewId: string) => Promise<void>;
  className?: string;
}

export function SavedViews({
  views,
  currentFilters,
  activeViewId,
  onViewSelect,
  onViewSave,
  onViewDelete,
  onSetDefault,
  className,
}: SavedViewsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const activeView = views.find((v) => v.id === activeViewId);
  const hasUnsavedChanges =
    activeView &&
    JSON.stringify(currentFilters) !== JSON.stringify(activeView.filters);

  const handleSaveView = async () => {
    if (!newViewName.trim()) {
      toast.error('Please enter a view name');
      return;
    }

    setIsSaving(true);
    try {
      await onViewSave(newViewName.trim(), currentFilters);
      toast.success(`View "${newViewName}" saved`);
      setNewViewName('');
      setIsSaveDialogOpen(false);
    } catch {
      toast.error('Failed to save view');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteView = async (view: SavedView, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onViewDelete(view.id);
      toast.success(`View "${view.name}" deleted`);
    } catch {
      toast.error('Failed to delete view');
    }
  };

  const handleSetDefault = async (view: SavedView, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSetDefault) return;
    try {
      await onSetDefault(view.id);
      toast.success(`"${view.name}" is now your default view`);
    } catch {
      toast.error('Failed to set default view');
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-9 gap-2', className)}
          >
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">
              {activeView ? activeView.name : 'Views'}
            </span>
            {hasUnsavedChanges && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Saved Views</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setIsOpen(false);
                setIsSaveDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Save Current
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {views.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No saved views yet
            </div>
          ) : (
            views.map((view) => (
              <DropdownMenuItem
                key={view.id}
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => {
                  onViewSelect(view);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {view.isDefault && (
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{view.name}</span>
                  {activeViewId === view.id && (
                    <Check className="h-3 w-3 text-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onSetDefault && !view.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleSetDefault(view, e)}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => handleDeleteView(view, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}

          {hasUnsavedChanges && activeView && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-2">
                <p className="text-xs text-muted-foreground mb-2">
                  You have unsaved changes to "{activeView.name}"
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => {
                    onViewSave(activeView.name, currentFilters);
                    setIsOpen(false);
                  }}
                >
                  Update View
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save your current filters as a reusable view for quick access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                View Name
              </label>
              <Input
                id="view-name"
                placeholder="e.g., Active RN Licenses"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveView();
                }}
              />
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Current Filters:
              </p>
              <pre className="text-xs overflow-auto max-h-32">
                {JSON.stringify(currentFilters, null, 2)}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveView} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save View'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook for managing saved views with localStorage
export function useSavedViews(storageKey: string) {
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = React.useState<string | undefined>();

  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setViews(parsed.views || []);
        setActiveViewId(parsed.activeViewId);
      } catch {
        console.error('Failed to parse saved views');
      }
    }
  }, [storageKey]);

  const saveToStorage = React.useCallback(
    (newViews: SavedView[], newActiveId?: string) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ views: newViews, activeViewId: newActiveId })
      );
    },
    [storageKey]
  );

  const saveView = React.useCallback(
    async (name: string, filters: Record<string, unknown>) => {
      const existingIndex = views.findIndex((v) => v.name === name);
      let newViews: SavedView[];

      if (existingIndex >= 0) {
        // Update existing view
        newViews = views.map((v, i) =>
          i === existingIndex ? { ...v, filters, createdAt: new Date().toISOString() } : v
        );
      } else {
        // Create new view
        const newView: SavedView = {
          id: crypto.randomUUID(),
          name,
          filters,
          createdAt: new Date().toISOString(),
        };
        newViews = [...views, newView];
      }

      setViews(newViews);
      saveToStorage(newViews, activeViewId);
    },
    [views, activeViewId, saveToStorage]
  );

  const deleteView = React.useCallback(
    async (viewId: string) => {
      const newViews = views.filter((v) => v.id !== viewId);
      setViews(newViews);
      if (activeViewId === viewId) {
        setActiveViewId(undefined);
      }
      saveToStorage(newViews, activeViewId === viewId ? undefined : activeViewId);
    },
    [views, activeViewId, saveToStorage]
  );

  const selectView = React.useCallback(
    (view: SavedView) => {
      setActiveViewId(view.id);
      saveToStorage(views, view.id);
    },
    [views, saveToStorage]
  );

  const setDefault = React.useCallback(
    async (viewId: string) => {
      const newViews = views.map((v) => ({
        ...v,
        isDefault: v.id === viewId,
      }));
      setViews(newViews);
      saveToStorage(newViews, activeViewId);
    },
    [views, activeViewId, saveToStorage]
  );

  const getDefaultView = React.useCallback(() => {
    return views.find((v) => v.isDefault);
  }, [views]);

  return {
    views,
    activeViewId,
    saveView,
    deleteView,
    selectView,
    setDefault,
    getDefaultView,
  };
}

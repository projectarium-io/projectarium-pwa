export interface Project {
  id: number;
  name: string;
  description: string;
  path: string | null;
  file: string;
  priority: number;
  status: string;
  language: string;
  position: number;
}

export interface Todo {
  id: number;
  description: string;
  priority: number;
  checked: boolean;
  project_id: number | null;
}

export type KanbanStatus = 'abandoned' | 'backlog' | 'active' | 'completed';

export const KANBAN_COLUMNS: { key: KanbanStatus; label: string }[] = [
  { key: 'abandoned', label: 'Abandoned' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export function normalizeStatus(status: string): KanbanStatus {
  const lower = status.toLowerCase().trim();
  if (lower === 'done' || lower === 'completed' || lower === 'finished') return 'completed';
  if (lower === 'abandoned' || lower === 'archived') return 'abandoned';
  if (lower === 'backlog' || lower === 'ready' || lower === 'paused') return 'backlog';
  if (lower === 'active' || lower === 'in_progress' || lower === 'in-progress') return 'active';
  return 'backlog';
}

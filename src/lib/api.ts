import { Project, Todo } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content (e.g. DELETE responses)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ── Project endpoints ──

export async function getProjects(): Promise<Project[]> {
  return fetchApi<Project[]>('/projects');
}

export async function getProject(id: number): Promise<Project> {
  return fetchApi<Project>(`/projects/${id}`);
}

export async function createProject(data: Partial<Project>): Promise<Project> {
  return fetchApi<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  id: number,
  data: Partial<Project>
): Promise<Project> {
  return fetchApi<Project>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: number): Promise<void> {
  return fetchApi<void>(`/projects/${id}`, {
    method: 'DELETE',
  });
}

export async function updateProjectStatus(
  id: number,
  status: string
): Promise<Project> {
  return fetchApi<Project>(`/projects/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function updateProjectPriority(
  id: number,
  priority: number
): Promise<Project> {
  return fetchApi<Project>(`/projects/${id}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priority }),
  });
}

export async function reorderProjects(
  order: Record<string, number[]>
): Promise<Project[]> {
  return fetchApi<Project[]>('/projects/reorder', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  });
}

// ── Todo endpoints ──

export async function getTodos(projectId?: number): Promise<Todo[]> {
  const endpoint = projectId
    ? `/todos?project_id=${projectId}`
    : '/todos';
  return fetchApi<Todo[]>(endpoint);
}

export async function getTodo(id: number): Promise<Todo> {
  return fetchApi<Todo>(`/todos/${id}`);
}

export async function createTodo(data: {
  description: string;
  priority: number;
  project_id: number;
}): Promise<Todo> {
  return fetchApi<Todo>('/todos', {
    method: 'POST',
    body: JSON.stringify({ ...data, checked: false }),
  });
}

export async function updateTodo(
  id: number,
  data: Partial<Todo>
): Promise<Todo> {
  return fetchApi<Todo>(`/todos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTodo(id: number): Promise<void> {
  return fetchApi<void>(`/todos/${id}`, {
    method: 'DELETE',
  });
}

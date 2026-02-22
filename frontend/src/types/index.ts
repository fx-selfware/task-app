export type TaskStatus = 'TODO' | 'DONE';
export type Permission = 'READ' | 'WRITE';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  order: number;
  taskListId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListShare {
  id: string;
  permission: Permission;
  user: { id: string; email: string; name: string };
}

export interface TaskList {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  shares?: TaskListShare[];
  owner?: { id: string; email: string; name: string };
}

export interface TaskListSummary extends TaskList {
  role: 'owner' | 'shared';
  permission?: Permission;
  _count?: { tasks: number };
}

export interface TemplateTask {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  templateId: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tasks?: TemplateTask[];
  _count?: { tasks: number };
}

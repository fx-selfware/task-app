export interface TaskListEvent {
  type: 'tasks-changed';
  userId: string;
}

type Listener = (event: TaskListEvent) => void;

const subscribers = new Map<string, Set<Listener>>();

export function subscribe(listId: string, listener: Listener): () => void {
  if (!subscribers.has(listId)) {
    subscribers.set(listId, new Set());
  }
  subscribers.get(listId)!.add(listener);

  return () => {
    const set = subscribers.get(listId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        subscribers.delete(listId);
      }
    }
  };
}

export function publish(listId: string, event: TaskListEvent): void {
  const set = subscribers.get(listId);
  if (set) {
    for (const listener of set) {
      listener(event);
    }
  }
}

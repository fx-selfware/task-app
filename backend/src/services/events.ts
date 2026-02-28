type Listener = () => void;

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

export function publish(listId: string): void {
  subscribers.get(listId)?.forEach((fn) => fn());
}

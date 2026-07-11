type Listener = () => void;

// Stashed on globalThis so subscriptions survive Next dev HMR reloads.
const globalForEvents = globalThis as unknown as { __taskAppSubscribers?: Map<string, Set<Listener>> };
const subscribers = (globalForEvents.__taskAppSubscribers ??= new Map<string, Set<Listener>>());

export function subscribe(channelId: string, listener: Listener): () => void {
  if (!subscribers.has(channelId)) {
    subscribers.set(channelId, new Set());
  }
  subscribers.get(channelId)!.add(listener);

  return () => {
    const set = subscribers.get(channelId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        subscribers.delete(channelId);
      }
    }
  };
}

export function publish(channelId: string): void {
  subscribers.get(channelId)?.forEach((fn) => fn());
}

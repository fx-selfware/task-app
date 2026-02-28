import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useTemplateEvents(templateId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!templateId) return;

    let isFirstOpen = true;
    const eventSource = new EventSource(`/api/templates/${templateId}/events`);

    eventSource.onopen = () => {
      if (isFirstOpen) {
        isFirstOpen = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    };

    eventSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    };

    return () => {
      eventSource.close();
    };
  }, [templateId, queryClient]);
}

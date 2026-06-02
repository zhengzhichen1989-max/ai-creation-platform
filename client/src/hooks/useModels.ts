import { useQuery } from '@tanstack/react-query';
import * as modelsApi from '@/api/models';

/** Fetch models with optional type filter */
export function useModels(type?: 'image' | 'video') {
  return useQuery({
    queryKey: ['models', type],
    queryFn: () => modelsApi.listModels(type),
  });
}

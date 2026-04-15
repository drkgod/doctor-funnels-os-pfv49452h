import { useTenant } from '@/hooks/useTenant'

export function useModuleAccess(module_key: string) {
  const { isModuleEnabled, loading } = useTenant()
  return {
    isEnabled: isModuleEnabled(module_key),
    isLoading: loading,
  }
}

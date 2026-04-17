import { createContext, useContext, useRef, useEffect, ReactNode } from 'react'

interface CacheEntry {
  data: any
  timestamp: number
}

interface DataCacheContextType {
  getCachedData: (key: string, maxAge?: number) => any | undefined
  setCachedData: (key: string, data: any) => void
  invalidateCache: (keyOrPrefix: string, isPrefix?: boolean) => void
  clearAllCache: () => void
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined)

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const getCachedData = (key: string, maxAge: number = 300000) => {
    const entry = cacheRef.current.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > maxAge) {
      cacheRef.current.delete(key)
      return undefined
    }
    return entry.data
  }

  const setCachedData = (key: string, data: any) => {
    cacheRef.current.set(key, { data, timestamp: Date.now() })
  }

  const invalidateCache = (keyOrPrefix: string, isPrefix: boolean = false) => {
    if (isPrefix) {
      for (const key of cacheRef.current.keys()) {
        if (key.startsWith(keyOrPrefix)) {
          cacheRef.current.delete(key)
        }
      }
    } else {
      cacheRef.current.delete(keyOrPrefix)
    }
  }

  const clearAllCache = () => {
    cacheRef.current.clear()
  }

  useEffect(() => {
    const handleSignOut = () => clearAllCache()
    window.addEventListener('auth-signout', handleSignOut)
    return () => window.removeEventListener('auth-signout', handleSignOut)
  }, [])

  return (
    <DataCacheContext.Provider
      value={{ getCachedData, setCachedData, invalidateCache, clearAllCache }}
    >
      {children}
    </DataCacheContext.Provider>
  )
}

export function useDataCache() {
  const context = useContext(DataCacheContext)
  if (!context) throw new Error('useDataCache must be used within a DataCacheProvider')
  return context
}

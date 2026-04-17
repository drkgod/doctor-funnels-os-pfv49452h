import { useState, useEffect, useRef } from 'react'

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = useRef(0)
  const isPullingRef = useRef(false)
  const THRESHOLD = 60

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY
        isPullingRef.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current) return

      const y = e.touches[0].clientY
      const distance = y - startYRef.current

      if (distance > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(distance * 0.5, THRESHOLD + 20))

        if (e.cancelable) {
          e.preventDefault()
        }
      } else {
        setPullDistance(0)
        isPullingRef.current = false
      }
    }

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return
      isPullingRef.current = false

      if (pullDistance > THRESHOLD) {
        setIsRefreshing(true)
        setPullDistance(THRESHOLD)
        try {
          await onRefresh()
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pullDistance, onRefresh])

  return { isRefreshing, pullDistance }
}

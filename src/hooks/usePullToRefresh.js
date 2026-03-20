import { useState, useEffect, useRef, useCallback } from 'react';

export function usePullToRefresh(onRefresh, threshold = 80) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const refreshingRef = useRef(false);

  const stableRefresh = useCallback(onRefresh, [onRefresh]);

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (window.scrollY > 5) return;
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const handleTouchMove = (e) => {
      if (!isPulling.current || refreshingRef.current) return;
      if (window.scrollY > 5) {
        isPulling.current = false;
        setPullDistance(0);
        return;
      }
      const distance = e.touches[0].clientY - startY.current;
      if (distance > 10) {
        e.preventDefault();
        const pulled = Math.min(distance * 0.4, threshold * 1.5);
        setPullDistance(pulled);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || refreshingRef.current) return;
      isPulling.current = false;
      const currentPull = pullDistance;

      if (currentPull >= threshold * 0.7) {
        setRefreshing(true);
        refreshingRef.current = true;
        setPullDistance(threshold * 0.6);
        try {
          await stableRefresh();
        } catch (e) {
          console.error('Refresh error:', e);
        } finally {
          setRefreshing(false);
          refreshingRef.current = false;
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [stableRefresh, pullDistance, threshold]);

  const pulling = pullDistance > threshold * 0.4;
  return { pulling, pullDistance, refreshing };
}

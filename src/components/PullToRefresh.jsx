import React from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function PullToRefresh({ onRefresh, children, threshold = 80 }) {
  const { pulling, pullDistance, refreshing } = usePullToRefresh(onRefresh, threshold);

  const showIndicator = pullDistance > 8 || refreshing;
  const indicatorY = Math.min(pullDistance, threshold) - 36;
  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div className="relative min-h-0">
      {showIndicator && (
        <div
          className="fixed left-1/2 z-50 flex flex-col items-center gap-1 pointer-events-none"
          style={{
            transform: `translateX(-50%) translateY(${Math.max(indicatorY, -8)}px)`,
            top: 0,
            transition: refreshing ? 'none' : 'transform 0.15s ease-out',
            opacity: Math.min(progress * 2, 1),
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: '#f5a623' }}
          >
            {refreshing ? (
              <div
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                style={{ animation: 'ptr-spin 0.7s linear infinite' }}
              />
            ) : (
              <span
                className="text-white text-base font-bold leading-none"
                style={{
                  display: 'inline-block',
                  transform: `rotate(${pulling ? 180 : progress * 180}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              >
                ↓
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium text-white/70 whitespace-nowrap">
            {refreshing ? 'Actualisation...' : pulling ? 'Relâchez ↑' : 'Tirez ↓'}
          </span>
        </div>
      )}

      <div
        style={{
          transform: showIndicator ? `translateY(${Math.min(pullDistance * 0.3, 30)}px)` : 'none',
          transition: pullDistance === 0 && !refreshing ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

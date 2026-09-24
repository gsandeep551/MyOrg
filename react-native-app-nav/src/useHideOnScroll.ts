import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Hides the tab bar while the user scrolls down through a list and brings it
 * back as soon as they scroll up or reach the top.
 *
 *   const { hidden, onScroll } = useHideOnScroll();
 *   <FlatList onScroll={onScroll} scrollEventThrottle={16} … />
 *   <IslandTabBar hidden={hidden} … />
 */
export function useHideOnScroll(threshold = 24) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  const travel = useRef(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - last.current;
      last.current = y;
      if (y <= 0) {
        travel.current = 0;
        setHidden(false);
        return;
      }
      // Accumulate movement in one direction so small jitters don't toggle it.
      travel.current = Math.sign(dy) === Math.sign(travel.current) ? travel.current + dy : dy;
      if (travel.current > threshold) setHidden(true);
      else if (travel.current < -threshold) setHidden(false);
    },
    [threshold],
  );

  return { hidden, onScroll, show: () => setHidden(false) };
}

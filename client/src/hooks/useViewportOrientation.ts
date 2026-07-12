import { useEffect, useState } from 'react';

function getIsLandscape() {
  return window.innerWidth > window.innerHeight;
}

export function useViewportOrientation() {
  const [isLandscape, setIsLandscape] = useState(getIsLandscape);

  useEffect(() => {
    const updateOrientation = () => setIsLandscape(getIsLandscape());

    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return isLandscape;
}

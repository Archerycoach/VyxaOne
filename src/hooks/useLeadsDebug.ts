import { useEffect, useRef } from "react";

/**
 * Debug hook to track UI freezing issues in leads page
 * Logs all state changes and identifies blocking operations
 */
export function useLeadsDebug(componentName: string, states: Record<string, any>) {
  const renderCount = useRef(0);
  const lastStates = useRef<Record<string, any>>({});

  useEffect(() => {
    renderCount.current += 1;
    
    const changedStates = Object.entries(states).filter(
      ([key, value]) => lastStates.current[key] !== value
    );

    if (changedStates.length > 0) {
      console.log(`[${componentName}] Render #${renderCount.current}`);
      changedStates.forEach(([key, value]) => {
        console.log(`  - ${key}:`, lastStates.current[key], "→", value);
      });
    }

    lastStates.current = { ...states };
  });

  return {
    renderCount: renderCount.current,
    logAction: (action: string, data?: any) => {
      console.log(`[${componentName}] ACTION: ${action}`, data || "");
    },
    logError: (action: string, error: any) => {
      console.error(`[${componentName}] ERROR in ${action}:`, error);
    }
  };
}
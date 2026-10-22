export const health = () => ({ service: 'fendor', status: 'running', stage: 'foundation' } as const);
export const readiness = () => ({ status: 'not_ready', reason: 'Persistent database and identity services are not connected yet.' } as const);

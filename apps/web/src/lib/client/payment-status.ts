export function paymentDisplayStatus(confirmed:boolean,financialHold:boolean,latestStatus:string|undefined,returnStatus:string):string {
 if(confirmed)return 'succeeded';
 if(financialHold)return 'review';
 // A URL or an unverified provider state must never claim that an order is paid.
 if(latestStatus==='succeeded'||returnStatus==='succeeded'||returnStatus==='review')return 'pending';
 if(latestStatus==='initializing'||latestStatus==='pending')return latestStatus;
 if(latestStatus==='failed'||latestStatus==='cancelled')return latestStatus;
 return ['failed','cancelled','pending','initializing'].includes(returnStatus)?returnStatus:'';
}

import type {OrderRequest,VendorProduct} from './marketplace';
type ErrorEnvelope={error?:{code?:string;message?:string}};
export class AdminApiError extends Error{status:number;code:string;constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}}
async function request<T>(path:string,body?:Record<string,unknown>):Promise<T>{const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const value=await response.json().catch(()=>({})) as T&ErrorEnvelope;if(!response.ok)throw new AdminApiError(response.status,value.error?.code??'REQUEST_FAILED',value.error?.message??'Fendor could not complete this admin action.');return value;}
export type AdminApplication={id:string;business_name:string;business_location:string;country:string;registration_number:string;account_type:'individual'|'company';review_note:string|null;status:string;created_at:string};
export type SupportCase={id:string;order_id:string|null;status:string;subject:string;version:number;assigned_to:string|null};
export type PendingUpload={id:string;owner_id:string;purpose:string;status:string;created_at:string};
export type Operations={orders:{state:string;count:number}[];overdue:{id:string;version:number;availability_deadline:string}[];finance:{id:string;state:string;version:number}[];remedies:{id:string;order_id:string;status:string;kind:string}[];workers:{name:string;last_started:string|null;last_succeeded:string|null;last_failed:string|null;lease_until:string|null}[];mail:{pending:number;failed:number}};
export const listApplications=()=>request<{applications:AdminApplication[]}>('/api/admin/vendor-applications');
export const reviewApplication=(id:string,decision:'approved'|'rejected'|'changes_requested'|'suspended',note:string)=>request(`/api/admin/vendor-applications/${id}/review`,{decision,note});
export const listAdminProducts=()=>request<{products:VendorProduct[];nextCursor:string|null}>('/api/admin/products?limit=50');
export const reviewProduct=(id:string,version:number,decision:'approved'|'rejected'|'paused',note:string)=>request(`/api/admin/products/${id}/review`,{version,decision,note});
export const listAdminOrders=()=>request<{orders:OrderRequest[];nextCursor:string|null}>('/api/admin/orders?limit=50');
export const getAdminCheckout=(id:string)=>request<Record<string,unknown>>(`/api/admin/orders/${id}/checkout`);
export const adminOrderAction=(id:string,action:string,body:Record<string,unknown>)=>request(`/api/admin/orders/${id}/${action}`,body);
export const listAdminSupport=()=>request<{cases:SupportCase[];nextCursor:string|null}>('/api/admin/support');
export const updateAdminSupport=(id:string,body:{version:number;message:string;internal:boolean;status:string;assignedTo?:string})=>request(`/api/admin/support/${id}`,body);
export const listPendingUploads=()=>request<{uploads:PendingUpload[]}>('/api/admin/uploads');
export const reviewUpload=(id:string,status:'approved'|'rejected',note:string)=>request(`/api/admin/uploads/${id}/review`,{status,note});
export const getOperations=()=>request<Operations>('/api/admin/operations');
export const getAudit=()=>request<{events:Record<string,unknown>[]}>('/api/admin/audit');

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { SupabaseClients } from "../../platform/supabase.js";
import { permissionPreHandler } from "../authorization/require-permission.js";

type Options={supabase:SupabaseClients};
const recordSchema=z.object({
 code:z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{1,49}$/),
 name:z.string().trim().min(2).max(120),
 description:z.string().trim().max(500).nullable().optional(),
 sortOrder:z.number().int().min(-10000).max(10000).optional(),
 unitTypeId:z.string().uuid().optional(),
 parentId:z.string().uuid().nullable().optional(),
 isActive:z.boolean().default(true)
}).strict();
const idSchema=z.object({id:z.string().uuid()}).strict();
const assignmentSchema=z.object({membershipId:z.string().uuid(),orgUnitId:z.string().uuid(),designationId:z.string().uuid().nullable()}).strict();
const reportingSchema=z.object({membershipId:z.string().uuid(),managerMembershipId:z.string().uuid(),relationshipType:z.enum(["primary","dotted"])}).strict();
const meta=(request:any)=>({requestId:request.id,timestamp:new Date().toISOString(),version:"v1"});
function failure(reply:any,request:any,status:number,code:string,message:string){return reply.code(status).send({success:false,error:{code,message,details:[]},meta:meta(request)});}
function mapError(error:any,reply:any,request:any){
 if(error?.code==="42501")return failure(reply,request,403,"PERMISSION_DENIED","The required tenant permission is missing");
 if(error?.code==="P0002")return failure(reply,request,404,"RESOURCE_NOT_FOUND","The requested tenant resource was not found");
 if(error?.code==="23505")return failure(reply,request,409,"CODE_CONFLICT","A record with this code already exists in this tenant");
 if(error?.code==="23514")return failure(reply,request,409,"HIERARCHY_CONFLICT","The requested change violates a hierarchy constraint");
 if(error?.code==="22023")return failure(reply,request,400,"INVALID_MUTATION","The requested change is invalid");
 request.log.error({err:error},"Tenant administration mutation failed");
 return failure(reply,request,500,"MUTATION_FAILED","Unable to save tenant administration changes");
}
export const organizationAdminRoutes:FastifyPluginAsync<Options>=async(app,{supabase})=>{
 const mutate=async(request:any,reply:any,entity:"unit_type"|"unit"|"designation",action:"create"|"update",id:string|null)=>{
  const parsed=recordSchema.safeParse(request.body);if(!parsed.success)return failure(reply,request,400,"INVALID_BODY","Organization payload is invalid");
  const c=request.tenantContext;if(!c)return failure(reply,request,401,"UNAUTHORIZED","Tenant context is required");
  const v=parsed.data;
  const {data,error}=await supabase.admin.rpc("manage_tenant_org_record",{p_tenant_id:c.tenantId,p_actor_user_id:c.userId,p_request_id:request.id,p_entity:entity,p_action:action,p_record_id:id,p_code:v.code,p_name:v.name,p_description:v.description??null,p_sort_order:v.sortOrder??0,p_unit_type_id:v.unitTypeId??null,p_parent_id:v.parentId??null,p_is_active:v.isActive});
  if(error)return mapError(error,reply,request);
  return reply.code(action==="create"?201:200).send({success:true,data,meta:meta(request)});
 };
 for(const [path,entity,permission] of [["/unit-types","unit_type","organization.manage"],["/units","unit","organization.manage"],["/designations","designation","designation.manage"]] as const){
  app.post(path,{preHandler:permissionPreHandler(permission)},(request,reply)=>mutate(request,reply,entity,"create",null));
  app.patch(path+"/:id",{preHandler:permissionPreHandler(permission)},(request,reply)=>{
   const p=idSchema.safeParse(request.params);if(!p.success)return failure(reply,request,400,"INVALID_ID","Resource ID is invalid");
   return mutate(request,reply,entity,"update",p.data.id);
  });
 }
 app.put("/memberships/:membershipId/organization",{preHandler:permissionPreHandler("membership.manage")},async(request,reply)=>{
  const p=z.object({membershipId:z.string().uuid()}).safeParse(request.params),b=assignmentSchema.safeParse(request.body);
  if(!p.success||!b.success)return failure(reply,request,400,"INVALID_ASSIGNMENT","Membership or organization assignment is invalid");
  const c=request.tenantContext;if(!c)return failure(reply,request,401,"UNAUTHORIZED","Tenant context is required");
  const {data,error}=await supabase.admin.rpc("set_tenant_member_org_assignment",{p_tenant_id:c.tenantId,p_actor_user_id:c.userId,p_request_id:request.id,p_membership_id:p.data.membershipId,p_org_unit_id:b.data.orgUnitId,p_designation_id:b.data.designationId});
  if(error)return mapError(error,reply,request);
  return {success:true,data,meta:meta(request)};
 });
 app.put("/memberships/:membershipId/reporting",{preHandler:permissionPreHandler("reporting.manage")},async(request,reply)=>{
  const p=z.object({membershipId:z.string().uuid()}).safeParse(request.params),b=reportingSchema.safeParse(request.body);
  if(!p.success||!b.success||p.data?.membershipId!==b.data?.membershipId)return failure(reply,request,400,"INVALID_REPORTING","Reporting relationship payload is invalid");
  const c=request.tenantContext;if(!c)return failure(reply,request,401,"UNAUTHORIZED","Tenant context is required");
  const {data,error}=await supabase.admin.rpc("set_tenant_reporting_relationship",{p_tenant_id:c.tenantId,p_actor_user_id:c.userId,p_request_id:request.id,p_membership_id:p.data.membershipId,p_manager_membership_id:b.data.managerMembershipId,p_relationship_type:b.data.relationshipType});
  if(error)return mapError(error,reply,request);
  return {success:true,data,meta:meta(request)};
 });
};
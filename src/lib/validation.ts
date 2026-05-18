import { z } from 'zod';

// === Portal Schemas ===

export const registrationSchema = z.object({
  companyName: z.string().min(3).max(100).trim(),
  companySlug: z
    .string()
    .min(3)
    .max(30)
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Slug hanya boleh huruf kecil, angka, dan tanda hubung'
    ),
  adminEmail: z.string().email().max(255),
  adminUsername: z.string().min(3).max(30).regex(/^[a-zA-Z0-9]+$/),
  adminPassword: z.string().min(8).max(128),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

export const activateLicenseSchema = z.object({
  licenseCode: z.string().min(1),
});
export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;

export const companyProfileSchema = z.object({
  companyName: z.string().min(3).max(100).trim().optional(),
  contactEmail: z.string().email().max(255).optional(),
  contactPhone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const customDomainSchema = z.object({
  domain: z
    .string()
    .min(4)
    .max(255)
    .regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/),
});
export type CustomDomainInput = z.infer<typeof customDomainSchema>;

// === Tenant App Schemas ===

export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9]+$/),
  password: z.string().min(8).max(128),
  role: z.enum(['Superadmin', 'HRD', 'Resepsionis']),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});
export type UpdateUserPasswordInput = z.infer<typeof updateUserPasswordSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(['Superadmin', 'HRD', 'Resepsionis']),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const createMachineSchema = z.object({
  kodeDealer: z.string().min(1).max(20).trim(),
  namaDealer: z.string().min(1).max(100).trim(),
  serialNumber: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(50).trim(),
});
export type CreateMachineInput = z.infer<typeof createMachineSchema>;

export const createEmployeeSchema = z.object({
  kodeKaryawan: z.string().min(1).max(100).trim(),
  namaKaryawan: z.string().min(1).max(100).trim(),
  branches: z.array(z.string()).min(1),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const reportFilterSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kodeDealer: z.string().optional(),
});
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

export const branchScheduleSchema = z.object({
  jamMasuk: z.string().regex(/^\d{2}:\d{2}$/),
  toleranceMinutes: z.number().int().min(0).max(60),
  workDays: z.array(z.number().int().min(1).max(7)).min(1),
});
export type BranchScheduleInput = z.infer<typeof branchScheduleSchema>;

// === Admin Schemas ===

export const suspendTenantSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;

export const activateTenantSchema = z.object({
  planType: z.enum(['monthly', 'yearly']),
  durationDays: z.number().int().min(1),
});
export type ActivateTenantInput = z.infer<typeof activateTenantSchema>;

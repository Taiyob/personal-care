import { z } from "zod";

export const AddressValidation = {
  create: z
    .object({
      fullName: z.string().min(2).max(100).trim(),
      phone: z.string().min(10).max(15).trim(),
      addressLine1: z.string().min(5).max(200).trim(),
      addressLine2: z.string().max(200).trim().optional(),
      city: z.string().min(2).max(100).trim(),
      zone: z.string().max(100).trim().optional(),
      division: z.string().max(100).trim().optional(),
      postalCode: z.string().max(20).trim().optional(),
      isDefault: z.boolean().optional().default(false),
      addressType: z.string().max(20).trim().optional(),
      country: z.string().max(100).trim().default("Bangladesh"),
    })
    .strict(),

  update: z
    .object({
      fullName: z.string().min(2).max(100).trim().optional(),
      phone: z.string().min(10).max(15).trim().optional(),
      addressLine1: z.string().min(5).max(200).trim().optional(),
      addressLine2: z.string().max(200).trim().optional(),
      city: z.string().min(2).max(100).trim().optional(),
      zone: z.string().max(100).trim().optional(),
      division: z.string().max(100).trim().optional(),
      postalCode: z.string().max(20).trim().optional(),
      isDefault: z.boolean().optional(),
      addressType: z.string().max(20).trim().optional(),
      country: z.string().max(100).trim().optional(),
    })
    .strict(),

  params: {
    id: z.object({ id: z.string().uuid("Address ID must be a valid UUID") }),
  },
};

export type CreateAddressInput = z.infer<typeof AddressValidation.create>;
export type UpdateAddressInput = z.infer<typeof AddressValidation.update>;

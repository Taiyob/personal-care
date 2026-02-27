import multer, { Field } from "multer";
import { BadRequestError } from "@/core/errors/AppError";

// ─── Multer config: memory storage only (no disk) ────────────────────────────
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new BadRequestError(
                "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
            ) as any,
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE },
});

// ─── Exported helpers ─────────────────────────────────────────────────────────

/** Single image upload — pass field name e.g. "image", "avatar" */
export const uploadSingle = (fieldName: string) => upload.single(fieldName);

/** Multiple images under same field name — max n files */
export const uploadMultiple = (fieldName: string, maxCount: number) =>
    upload.array(fieldName, maxCount);

/** Mixed fields — e.g. products: featuredImage + images[] */
export const uploadFields = (fields: Field[]) => upload.fields(fields);

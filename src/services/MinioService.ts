import { Client } from "minio";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { config } from "@/core/config";
import { AppLogger } from "@/core/logging/logger";

// ─── Singleton MinIO client ───────────────────────────────────────────────────
const minioClient = new Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
});

const BUCKET = config.minio.bucketName;

// ─── Ensure bucket exists on startup ─────────────────────────────────────────
async function ensureBucketExists(): Promise<void> {
    try {
        const exists = await minioClient.bucketExists(BUCKET);
        if (!exists) {
            await minioClient.makeBucket(BUCKET);
            AppLogger.info(`MinIO: Bucket "${BUCKET}" created`);
        }
    } catch (err) {
        AppLogger.error("MinIO: Failed to ensure bucket exists", { err });
    }
}

ensureBucketExists();

// ─── MinioService ─────────────────────────────────────────────────────────────
export class MinioService {
    /**
     * Upload a file to MinIO.
     * @param folder  — logical folder prefix e.g. "products", "categories", "avatars"
     * @param file    — Express.Multer.File with buffer + originalname + mimetype
     * @returns       — full public URL of the uploaded object
     */
    static async uploadFile(
        folder: string,
        file: Express.Multer.File
    ): Promise<string> {
        const ext = path.extname(file.originalname).toLowerCase();
        const objectName = `${folder}/${uuidv4()}${ext}`;

        await minioClient.putObject(BUCKET, objectName, file.buffer, file.size, {
            "Content-Type": file.mimetype,
        });

        const url = MinioService.buildUrl(objectName);
        AppLogger.info("MinIO: File uploaded", { objectName, url });
        return url;
    }

    /**
     * Delete a file from MinIO by its full URL or object key.
     * Safe — will not throw if object does not exist.
     */
    static async deleteFile(urlOrKey: string): Promise<void> {
        try {
            const objectKey = MinioService.extractObjectKey(urlOrKey);
            if (!objectKey) return;
            await minioClient.removeObject(BUCKET, objectKey);
            AppLogger.info("MinIO: File deleted", { objectKey });
        } catch (err: any) {
            // Ignore "NoSuchKey" — object already gone
            if (err?.code !== "NoSuchKey") {
                AppLogger.warn("MinIO: Failed to delete object", {
                    urlOrKey,
                    err: err?.message,
                });
            }
        }
    }

    /**
     * Delete multiple files from MinIO. Fires in parallel, ignores failures.
     */
    static async deleteFiles(urlsOrKeys: string[]): Promise<void> {
        await Promise.allSettled(
            urlsOrKeys.filter(Boolean).map((u) => MinioService.deleteFile(u))
        );
    }

    /**
     * Extract the MinIO object key from a full URL.
     * e.g. "http://s3.mickanic.ca:9003/mybucket-ezze/products/uuid.jpg"
     *   →  "products/uuid.jpg"
     */
    static extractObjectKey(urlOrKey: string): string | null {
        if (!urlOrKey) return null;
        try {
            // If it looks like a full URL, parse it
            if (urlOrKey.startsWith("http")) {
                const parsed = new URL(urlOrKey);
                // pathname is like /bucket-name/folder/file.jpg
                const parts = parsed.pathname.split("/").filter(Boolean);
                // Remove bucket name prefix
                if (parts[0] === BUCKET) {
                    return parts.slice(1).join("/");
                }
                // If bucket not in path, assume whole thing is key
                return parts.join("/");
            }
            return urlOrKey; // already a key
        } catch {
            return urlOrKey;
        }
    }

    /**
     * Build the public URL for an object key.
     */
    private static buildUrl(objectKey: string): string {
        const protocol = config.minio.useSSL ? "https" : "http";
        const port = config.minio.port;
        const portStr =
            (protocol === "http" && port === 80) ||
                (protocol === "https" && port === 443)
                ? ""
                : `:${port}`;
        return `${protocol}://${config.minio.endPoint}${portStr}/${BUCKET}/${objectKey}`;
    }
}

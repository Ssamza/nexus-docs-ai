import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000";

// For Backblaze B2 the region is embedded in the endpoint (e.g. s3.us-east-005.backblazeb2.com)
// For MinIO/local we fall back to us-east-1
const regionMatch = endpoint.match(/s3\.([^.]+\d+)\./);
const region = regionMatch ? regionMatch[1] : "us-east-1";

export const s3 = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "",
  },
  forcePathStyle: false,
});

export const BUCKET = "nexus-documents";

export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 300 } // 5 minutes
  );
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

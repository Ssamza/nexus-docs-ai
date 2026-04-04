import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "./storage";

export async function setupStorage(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket "${BUCKET}" created`);
  }
}

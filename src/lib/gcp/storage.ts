import { Storage } from "@google-cloud/storage";

let storage: Storage | null = null;

const bucketName = () => {
  const name = process.env.PACKETS_BUCKET;
  if (!name) throw new Error("Missing required environment variable PACKETS_BUCKET.");
  return name;
};

const client = () => (storage ??= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT }));

export const putPacket = async (path: string, bytes: Uint8Array) => {
  await client().bucket(bucketName()).file(path).save(Buffer.from(bytes), {
    contentType: "application/pdf",
    resumable: false,
  });
  return path;
};

export const getPacket = async (path: string): Promise<Uint8Array> => {
  const [buf] = await client().bucket(bucketName()).file(path).download();
  return new Uint8Array(buf);
};

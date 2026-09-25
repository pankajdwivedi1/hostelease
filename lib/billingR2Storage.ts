import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";

export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "a9ae2d32d680701b543584167b43aa44";
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "1c9011d11cb2cd98d9fdd7834da38324";
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "b359c3fc5b0bf1d23027286e1a6726d48d3752f4cdf7ea1e66096e22f7c68ff0";
export const R2_BUCKET = process.env.R2_PHOTOS_BUCKET_NAME || "hosteleaze-student-photos";
export const R2_PUBLIC_BASE = (
  process.env.R2_PHOTOS_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_PHOTOS_PUBLIC_URL ||
  "https://pub-754ab0d29b3a43b69d79a461c85d3056.r2.dev"
).replace(/\/$/, "");

function getR2Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

async function streamToString(stream: any): Promise<string> {
  if (!stream) return "";
  if (typeof stream.transformToString === "function") {
    return await stream.transformToString();
  }
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

/**
 * Save complete billing ledger list to Cloudflare R2 (Permanent Master Copy)
 */
export async function saveBillingLedgerToR2(logs: any[]): Promise<boolean> {
  try {
    const client = getR2Client();
    const jsonStr = JSON.stringify(logs, null, 2);
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: "billing-ledger/master_ledger.json",
        Body: Buffer.from(jsonStr, "utf-8"),
        ContentType: "application/json",
        CacheControl: "no-cache, no-store, must-revalidate",
      })
    );
    return true;
  } catch (err) {
    console.error("Failed to save billing ledger to Cloudflare R2:", err);
    return false;
  }
}

/**
 * Fetch complete billing ledger list from Cloudflare R2
 */
export async function getBillingLedgerFromR2(): Promise<any[] | null> {
  try {
    const client = getR2Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: "billing-ledger/master_ledger.json",
      })
    );
    const content = await streamToString(response.Body);
    if (!content) return null;
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.warn("Cloudflare R2 ledger fetch notice:", err?.message || err);
    return null;
  }
}

/**
 * Fetch individual immutable invoice JSON snapshot from Cloudflare R2
 */
export async function getInvoiceDocumentFromR2(invoiceId: string): Promise<any | null> {
  try {
    if (!invoiceId) return null;
    const client = getR2Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: `invoices/${invoiceId}.json`,
      })
    );
    const content = await streamToString(response.Body);
    if (!content) return null;
    return JSON.parse(content);
  } catch (err: any) {
    return null;
  }
}

/**
 * Save individual immutable invoice JSON snapshot to Cloudflare R2
 */
export async function saveInvoiceDocumentToR2(invoice: any): Promise<boolean> {
  try {
    if (!invoice || !invoice.id) return false;
    const client = getR2Client();
    const jsonStr = JSON.stringify(invoice, null, 2);
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: `invoices/${invoice.id}.json`,
        Body: Buffer.from(jsonStr, "utf-8"),
        ContentType: "application/json",
        CacheControl: "no-cache, no-store, must-revalidate",
      })
    );
    return true;
  } catch (err) {
    console.error(`Failed to save invoice ${invoice?.id} to Cloudflare R2:`, err);
    return false;
  }
}

/**
 * Delete individual invoice JSON document from Cloudflare R2
 */
export async function deleteInvoiceDocumentFromR2(invoiceId: string): Promise<boolean> {
  try {
    if (!invoiceId) return false;
    const client = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: `invoices/${invoiceId}.json`,
      })
    );
    return true;
  } catch (err) {
    console.warn(`Failed to delete invoice ${invoiceId} from Cloudflare R2:`, err);
    return false;
  }
}

/**
 * Upload an invoice payment proof screenshot to Cloudflare R2 with permanent public URL
 */
export async function uploadInvoiceScreenshotToR2(
  buffer: Buffer,
  invoiceId: string,
  mimeType: string = "image/png"
): Promise<string> {
  const client = getR2Client();
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const key = `invoices/screenshots/${invoiceId}_${Date.now()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${R2_PUBLIC_BASE}/${key}`;
}

/**
 * Retrieve ALL invoices from Cloudflare R2 (Deep Sync: Master Ledger + All invoices/*.json)
 */
export async function listAllInvoicesFromR2(): Promise<any[]> {
  const client = getR2Client();
  const invoiceMap = new Map<string, any>();

  // 1. First get all invoices from master_ledger.json
  try {
    const masterLogs = await getBillingLedgerFromR2();
    if (masterLogs && Array.isArray(masterLogs)) {
      for (const log of masterLogs) {
        if (log && log.id) {
          invoiceMap.set(log.id, log);
        }
      }
    }
  } catch (e) {}

  // 2. Scan individual invoices/ folder in R2 for any additional or standalone invoices
  try {
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: "invoices/",
        MaxKeys: 1000,
      })
    );

    if (listRes.Contents && listRes.Contents.length > 0) {
      for (const obj of listRes.Contents) {
        if (obj.Key && obj.Key.endsWith(".json") && !obj.Key.includes("screenshots")) {
          const invId = obj.Key.replace("invoices/", "").replace(".json", "");
          if (!invoiceMap.has(invId)) {
            try {
              const doc = await getInvoiceDocumentFromR2(invId);
              if (doc && doc.id) {
                invoiceMap.set(doc.id, doc);
              }
            } catch (e) {}
          }
        }
      }
    }
  } catch (err) {
    console.warn("Notice scanning individual R2 invoice documents:", err);
  }

  const allLogs = Array.from(invoiceMap.values()).sort((a, b) => {
    const dateA = new Date(a.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // Re-save merged master ledger to R2 so it's always up to date
  if (allLogs.length > 0) {
    await saveBillingLedgerToR2(allLogs);
  }

  return allLogs;
}

export const OGI_SEED_TRANSACTION = {
  id: "tx_seed_ogi",
  tenantId: "26739d24-0214-409b-aa81-42e628e88c2b",
  tenantName: "Oriental Group of Institutes (OGI)",
  amount: 23130,
  utr: "659864589235",
  date: "2026-03-07T16:23:43.395Z",
  billingType: "Verified Payment",
  paymentSource: "Direct Bank / UPI Transfer (UTR Verified)",
  billingPeriod: "1 Year",
  months: 12,
  studentCount: 500,
  ratePerStudentMonth: 30,
  grossBase: 180000,
  standardDiscountPercent: 43,
  standardDiscountAmount: 77400,
  extraDiscountType: "amount",
  extraDiscountAmount: 79470,
  extraDiscountPercent: 0,
  totalDiscountAmount: 156870,
  remarks: "Initial seeded payment proof",
  collegeDetails: {
    name: "Oriental Group of Institutes (OGI)",
    address: "Oriental Campus, Raisen Road, Bhopal, MP - 462021",
    email: "pankajdwivedi81@gmail.com",
    phone: "+91 9981414729 / 0755-2529015",
    contactName: "Dr Pankaj Dwivedi",
    contactPhone: "7974704918",
    gstin: ""
  }
};

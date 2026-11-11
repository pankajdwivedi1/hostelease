import { prisma } from "@/lib/prisma";
import webpush from "web-push";

// Initialize VAPID Keys
const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").replace(/^["']|["']$/g, "");
const privateKey = (process.env.VAPID_PRIVATE_KEY || "").replace(/^["']|["']$/g, "");

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails("mailto:support@hosteleaze.com", publicKey, privateKey);
  } catch (e) {
    console.warn("VAPID initialization failed:", e);
  }
}

export interface PromptChallenge {
  id: string;
  correctNumber: number;
  options: number[];
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  clientInfo: {
    ip: string;
    browser: string;
    os: string;
    location: string;
    timestamp: string;
  };
  createdAt: number;
  expiresAt: number;
}

// In-Memory store for fast, sub-second active challenge lookups
const activeChallenges = new Map<string, PromptChallenge>();

// Clean up expired challenges periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, challenge] of activeChallenges.entries()) {
      if (now > challenge.expiresAt) {
        activeChallenges.delete(id);
      }
    }
  }, 30000);
}

/**
 * Generates a random 2-digit number and 2 unique distractors
 */
function generateChallengeNumbers(): { correct: number; options: number[] } {
  const correct = Math.floor(10 + Math.random() * 89); // 10 to 99
  const optionsSet = new Set<number>([correct]);

  while (optionsSet.size < 3) {
    // Generate distinct distractors with similar magnitude
    const offset = (Math.random() > 0.5 ? 1 : -1) * Math.floor(5 + Math.random() * 25);
    let candidate = correct + offset;
    if (candidate < 10) candidate += 30;
    if (candidate > 99) candidate -= 30;
    optionsSet.add(candidate);
  }

  const options = Array.from(optionsSet);
  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { correct, options };
}

/**
 * Creates a new Instant Number Match Challenge and sends a Push Alert to the Master Phone
 */
export async function createPromptChallenge(clientInfo: {
  ip: string;
  browser: string;
  os: string;
  location?: string;
}): Promise<{ challengeId: string; correctNumber: number; expiresAt: number }> {
  const challengeId = "prompt_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const { correct, options } = generateChallengeNumbers();
  const now = Date.now();
  const expiresAt = now + 90 * 1000; // 90 seconds lifetime

  const challenge: PromptChallenge = {
    id: challengeId,
    correctNumber: correct,
    options,
    status: "PENDING",
    clientInfo: {
      ip: clientInfo.ip || "Unknown IP",
      browser: clientInfo.browser || "Chrome",
      os: clientInfo.os || "Windows PC",
      location: clientInfo.location || "Authorized Access Gateway",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    },
    createdAt: now,
    expiresAt
  };

  activeChallenges.set(challengeId, challenge);

  // Dispatch Web Push Notification to Master Security Phone
  try {
    await sendPushToMasterPhone(challenge);
  } catch (pushErr) {
    console.warn("Failed to dispatch push to master phone:", pushErr);
  }

  return {
    challengeId,
    correctNumber: correct,
    expiresAt
  };
}

/**
 * Gets details of a challenge for the phone display (options only, NOT revealing the correct answer)
 */
export function getChallengeForPhone(challengeId: string) {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) return null;

  if (Date.now() > challenge.expiresAt) {
    challenge.status = "EXPIRED";
    return {
      id: challenge.id,
      status: "EXPIRED",
      options: [],
      clientInfo: challenge.clientInfo
    };
  }

  return {
    id: challenge.id,
    status: challenge.status,
    options: challenge.options,
    clientInfo: challenge.clientInfo,
    expiresAt: challenge.expiresAt
  };
}

/**
 * Verifies the number tapped on the phone
 */
export function verifyPromptResponse(challengeId: string, selectedNumber: number): { success: boolean; status: string } {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) {
    return { success: false, status: "NOT_FOUND" };
  }

  if (Date.now() > challenge.expiresAt) {
    challenge.status = "EXPIRED";
    return { success: false, status: "EXPIRED" };
  }

  if (selectedNumber === challenge.correctNumber) {
    challenge.status = "APPROVED";
    return { success: true, status: "APPROVED" };
  } else {
    challenge.status = "REJECTED";
    return { success: false, status: "REJECTED" };
  }
}

/**
 * Explicitly rejects the challenge (User tapped "No, it's not me")
 */
export function rejectPromptChallenge(challengeId: string): boolean {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) return false;
  challenge.status = "REJECTED";
  return true;
}

/**
 * Checks status of an active challenge from the PC
 */
export function checkChallengeStatus(challengeId: string): { status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" } {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) {
    return { status: "EXPIRED" };
  }

  if (challenge.status === "PENDING" && Date.now() > challenge.expiresAt) {
    challenge.status = "EXPIRED";
  }

  return { status: challenge.status };
}

/**
 * Sends a high-priority Web Push Notification to the bound Master Phone
 */
async function sendPushToMasterPhone(challenge: PromptChallenge) {
  // 1. Fetch Master Phone binding from platform_settings
  const phoneRecord = await prisma.platformSetting.findUnique({
    where: { id: "boss_master_security_phone" }
  });

  const settings = (phoneRecord?.settings as any) || {};
  const subscription = settings.subscription;

  if (!subscription || !subscription.endpoint) {
    console.log("No Master Security Phone currently paired for push alerts.");
    return;
  }

  const payload = JSON.stringify({
    title: "🚨 Hosteleaze Security Alert",
    body: `Login attempt on ${challenge.clientInfo.os} (${challenge.clientInfo.browser}). Tap to verify.`,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: "hosteleaze-security-prompt",
    data: {
      url: `/security-prompt?challengeId=${challenge.id}`,
      challengeId: challenge.id
    }
  });

  await webpush.sendNotification(subscription, payload);
  console.log(`📡 [Push] Security challenge dispatched to Master Phone: ${challenge.id}`);
}

/**
 * Saves/Binds the current device as the Master Security Phone
 */
export async function bindMasterSecurityPhone(subscription: any, deviceInfo: { name?: string; userAgent?: string }) {
  const data = {
    isBound: true,
    boundAt: new Date().toISOString(),
    deviceName: deviceInfo.name || "Master Phone",
    userAgent: deviceInfo.userAgent || "",
    subscription
  };

  await prisma.platformSetting.upsert({
    where: { id: "boss_master_security_phone" },
    update: { settings: data },
    create: { id: "boss_master_security_phone", settings: data }
  });

  return { success: true, boundAt: data.boundAt };
}

/**
 * Unbinds the Master Security Phone
 */
export async function unbindMasterSecurityPhone() {
  await prisma.platformSetting.deleteMany({
    where: { id: "boss_master_security_phone" }
  });
  return { success: true };
}

/**
 * Checks whether a Master Security Phone is bound
 */
export async function getMasterSecurityPhoneStatus() {
  const phoneRecord = await prisma.platformSetting.findUnique({
    where: { id: "boss_master_security_phone" }
  });

  const settings = (phoneRecord?.settings as any) || {};
  return {
    isBound: Boolean(settings.isBound && settings.subscription),
    boundAt: settings.boundAt || null,
    deviceName: settings.deviceName || null
  };
}

interface OtpEntry {
  otp?: string;
  reqId?: string;
  expires: number;
}

const globalForOtp = global as unknown as {
  otpCache: Map<string, OtpEntry>;
};

export const otpCache = globalForOtp.otpCache || (globalForOtp.otpCache = new Map<string, OtpEntry>());

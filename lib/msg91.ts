export async function triggerLeaveVoiceCall(params: {
  phoneNumber: string;
  studentName: string;
  hostelName: string;
  fromDate: string;
  toDate: string;
  leaveId: string;
}) {
  const { phoneNumber, studentName, hostelName, fromDate, toDate, leaveId } = params;

  // Ensure phone number is prefixed with 91 if it's a 10-digit Indian number
  let formattedPhone = phoneNumber.replace(/\D/g, ""); // Remove non-digits
  if (formattedPhone.length === 10) {
    formattedPhone = "91" + formattedPhone;
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const campaignId = process.env.MSG91_VOICE_CAMPAIGN_ID; // The Flow/Campaign ID in MSG91

  if (!authKey || !campaignId) {
    console.warn("MSG91 API credentials missing. Voice call skipped.");
    return false;
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authkey": authKey,
      },
      body: JSON.stringify({
        template_id: campaignId,
        short_url: "0",
        recipients: [
          {
            mobiles: formattedPhone,
            var1: hostelName,
            var2: studentName,
            var3: fromDate,
            var4: toDate,
            var5: leaveId,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MSG91 API Error:", response.status, errorText);
      return false;
    }

    const data = await response.json();
    console.log("MSG91 Voice Call Triggered:", data);
    return true;
  } catch (error) {
    console.error("Failed to trigger MSG91 Voice Call:", error);
    return false;
  }
}
